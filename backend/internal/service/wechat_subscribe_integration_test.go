package service

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"wurenji-backend/internal/config"
	"wurenji-backend/internal/model"
	wechatpkg "wurenji-backend/internal/pkg/wechat"
	"wurenji-backend/internal/repository"
)

// ----------------------------------------------------------------------------
// 集成测试：覆盖 EventService → WeChatSubscribeService → grant repo → sender 整条链路。
// 不依赖真实 MySQL / 真实微信 HTTP / 真实业务事件入口（订单/支付）。
// 用 sqlite in-memory + fake user store + recording sender 全部本地化。
// ----------------------------------------------------------------------------

type fakeWeChatSubscribeUserStore struct {
	users map[int64]*model.User
}

func (f *fakeWeChatSubscribeUserStore) GetByID(id int64) (*model.User, error) {
	u, ok := f.users[id]
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	return u, nil
}

type recordingWeChatSender struct {
	mu       sync.Mutex
	messages []wechatpkg.SubscribeMessage
}

func (r *recordingWeChatSender) Send(_ context.Context, msg wechatpkg.SubscribeMessage) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.messages = append(r.messages, msg)
	return nil
}

func (r *recordingWeChatSender) sent() []wechatpkg.SubscribeMessage {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]wechatpkg.SubscribeMessage, len(r.messages))
	copy(out, r.messages)
	return out
}

type subscribeFixture struct {
	evt    *EventService
	sender *recordingWeChatSender
	repo   *repository.WeChatSubscribeRepo
	user   *model.User
}

func setupSubscribeIntegrationFixture(t *testing.T) *subscribeFixture {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("unwrap db: %v", err)
	}
	sqlDB.SetMaxOpenConns(1)
	if err := db.AutoMigrate(&model.WechatSubscribeGrant{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	repo := repository.NewWeChatSubscribeRepo(db)

	user := &model.User{
		ID:           42,
		Phone:        "13800138000",
		WechatOpenID: "openid_pilot_42",
	}
	users := &fakeWeChatSubscribeUserStore{users: map[int64]*model.User{user.ID: user}}
	sender := &recordingWeChatSender{}

	cfg := config.WeChatSubscribeConfig{
		Enabled: true,
		Templates: map[string]config.WeChatSubscribeTemplateConfig{
			"pilot_verification_result": {
				TemplateID: "tmpl_pilot_verify",
				Page:       "pages/profile/index",
				Data: map[string]string{
					"thing1":            "title",
					"thing2":            "content",
					"character_string3": "pilot_user_id",
				},
			},
		},
	}

	wechatSubscribe := NewWeChatSubscribeService(users, repo, sender, cfg, nil)
	evt := NewEventService(nil, nil, nil)
	evt.SetWeChatSubscribeService(wechatSubscribe)

	return &subscribeFixture{evt: evt, sender: sender, repo: repo, user: user}
}

func TestEventService_WeChatSubscribe_Integration(t *testing.T) {
	t.Run("happy path: openid + grant + allowlist event → sender called with correct payload", func(t *testing.T) {
		fx := setupSubscribeIntegrationFixture(t)
		if err := fx.repo.Grant(context.Background(), fx.user.ID, "tmpl_pilot_verify", 1); err != nil {
			t.Fatalf("grant: %v", err)
		}

		fx.evt.NotifyPilotVerification(fx.user.ID, true, "审核通过")

		sent := fx.sender.sent()
		if len(sent) != 1 {
			t.Fatalf("expected 1 message, got %d", len(sent))
		}
		msg := sent[0]
		if msg.ToUser != "openid_pilot_42" {
			t.Errorf("ToUser = %q, want openid_pilot_42", msg.ToUser)
		}
		if msg.TemplateID != "tmpl_pilot_verify" {
			t.Errorf("TemplateID = %q, want tmpl_pilot_verify", msg.TemplateID)
		}
		if msg.Data["thing1"].Value != "服务资质审核结果" {
			t.Errorf("Data[thing1] = %q", msg.Data["thing1"].Value)
		}
		if msg.Data["thing2"].Value != "您的服务资质已审核通过。" {
			t.Errorf("Data[thing2] = %q", msg.Data["thing2"].Value)
		}
		if msg.Data["character_string3"].Value != "42" {
			t.Errorf("Data[character_string3] = %q", msg.Data["character_string3"].Value)
		}

		// 额度应被扣减到 0
		consumed, err := fx.repo.TryConsume(context.Background(), fx.user.ID, "tmpl_pilot_verify")
		if err != nil {
			t.Fatalf("probe consume: %v", err)
		}
		if consumed {
			t.Errorf("expected no remaining grant after notify")
		}
	})

	t.Run("no grant: sender not called", func(t *testing.T) {
		fx := setupSubscribeIntegrationFixture(t)
		// 不预授权
		fx.evt.NotifyPilotVerification(fx.user.ID, true, "")
		if got := len(fx.sender.sent()); got != 0 {
			t.Errorf("expected 0 messages without grant, got %d", got)
		}
	})

	t.Run("event not in wechat subscribe allowlist: sender not called", func(t *testing.T) {
		fx := setupSubscribeIntegrationFixture(t)
		_ = fx.repo.Grant(context.Background(), fx.user.ID, "tmpl_pilot_verify", 5)
		// EventService 通用入口，但 demand_quote_submitted 不在 wechat 白名单
		// 直接走 notifyUsers 路径模拟
		fx.evt.notifyUsers([]int64{fx.user.ID}, "demand_quote_submitted", "收到新报价", "...", map[string]interface{}{})
		if got := len(fx.sender.sent()); got != 0 {
			t.Errorf("expected 0 messages for non-allowlist event, got %d", got)
		}
	})

	t.Run("no openid: sender not called", func(t *testing.T) {
		fx := setupSubscribeIntegrationFixture(t)
		fx.user.WechatOpenID = ""
		_ = fx.repo.Grant(context.Background(), fx.user.ID, "tmpl_pilot_verify", 5)
		fx.evt.NotifyPilotVerification(fx.user.ID, true, "")
		if got := len(fx.sender.sent()); got != 0 {
			t.Errorf("expected 0 messages without openid, got %d", got)
		}
	})

	t.Run("subscribe disabled in config: sender not called even with grant", func(t *testing.T) {
		fx := setupSubscribeIntegrationFixture(t)
		// 替换为 enabled=false 的服务
		users := &fakeWeChatSubscribeUserStore{users: map[int64]*model.User{fx.user.ID: fx.user}}
		disabledCfg := config.WeChatSubscribeConfig{Enabled: false}
		disabledSvc := NewWeChatSubscribeService(users, fx.repo, fx.sender, disabledCfg, nil)
		fx.evt.SetWeChatSubscribeService(disabledSvc)
		_ = fx.repo.Grant(context.Background(), fx.user.ID, "tmpl_pilot_verify", 5)

		fx.evt.NotifyPilotVerification(fx.user.ID, true, "")
		if got := len(fx.sender.sent()); got != 0 {
			t.Errorf("expected 0 messages when subscribe is disabled, got %d", got)
		}
	})
}

func TestWeChatSubscribeService_GrantAcceptedTemplates_PersistsAndDedupes(t *testing.T) {
	fx := setupSubscribeIntegrationFixture(t)
	users := &fakeWeChatSubscribeUserStore{users: map[int64]*model.User{fx.user.ID: fx.user}}
	cfg := config.WeChatSubscribeConfig{Enabled: true}
	svc := NewWeChatSubscribeService(users, fx.repo, fx.sender, cfg, nil)

	// 输入含重复与空字符串，预期去重+过滤后只授权 2 个模板
	granted, err := svc.GrantAcceptedTemplates(context.Background(), fx.user.ID, []string{
		"tmpl_a", "tmpl_a", "", "  ", "tmpl_b",
	})
	if err != nil {
		t.Fatalf("grant: %v", err)
	}
	if granted != 2 {
		t.Fatalf("expected 2 granted, got %d", granted)
	}

	// 第二次再调用同一模板，额度应累加（重复授权 = 用户多次确认）
	if _, err := svc.GrantAcceptedTemplates(context.Background(), fx.user.ID, []string{"tmpl_a"}); err != nil {
		t.Fatalf("second grant: %v", err)
	}

	// tmpl_a 应有 2 次额度
	consumed1, _ := fx.repo.TryConsume(context.Background(), fx.user.ID, "tmpl_a")
	consumed2, _ := fx.repo.TryConsume(context.Background(), fx.user.ID, "tmpl_a")
	consumed3, _ := fx.repo.TryConsume(context.Background(), fx.user.ID, "tmpl_a")
	if !consumed1 || !consumed2 {
		t.Errorf("expected 2 consumes succeed for tmpl_a, got %v %v", consumed1, consumed2)
	}
	if consumed3 {
		t.Errorf("expected 3rd consume to fail for tmpl_a (only 2 grants), got true")
	}

	// tmpl_b 应有 1 次额度
	consumedB1, _ := fx.repo.TryConsume(context.Background(), fx.user.ID, "tmpl_b")
	consumedB2, _ := fx.repo.TryConsume(context.Background(), fx.user.ID, "tmpl_b")
	if !consumedB1 {
		t.Errorf("expected 1st consume to succeed for tmpl_b")
	}
	if consumedB2 {
		t.Errorf("expected 2nd consume to fail for tmpl_b")
	}
}
