package model

import (
	"time"

	"gorm.io/gorm"
)

type OrderSettlement struct {
	ID           int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	SettlementNo string `gorm:"type:varchar(50);uniqueIndex;not null" json:"settlement_no"`
	OrderID      int64  `gorm:"uniqueIndex;not null" json:"order_id"`
	OrderNo      string `gorm:"type:varchar(30)" json:"order_no"`

	// ==================== 金额明细 ====================
	TotalAmount    int64 `json:"total_amount"`    // 订单总额(分)
	BaseFee        int64 `json:"base_fee"`        // 基础服务费(分)
	MileageFee     int64 `json:"mileage_fee"`     // 里程费(分)
	DurationFee    int64 `json:"duration_fee"`    // 时长费(分)
	WeightFee      int64 `json:"weight_fee"`      // 重量费(分)
	DifficultyFee  int64 `json:"difficulty_fee"`  // 难度附加费(分)
	InsuranceFee   int64 `json:"insurance_fee"`   // 保险费(分)
	SurgePricing   int64 `json:"surge_pricing"`   // 溢价/折扣(分, 正为溢价负为折扣)
	CouponDiscount int64 `json:"coupon_discount"` // 优惠券折扣(分)
	FinalAmount    int64 `json:"final_amount"`    // 最终支付金额(分)

	// ==================== 分账明细 ====================
	PlatformFeeRate    float64 `gorm:"type:decimal(5,4)" json:"platform_fee_rate"` // 平台费率
	PlatformFee        int64   `json:"platform_fee"`                               // 平台服务费(分)
	PilotFeeRate       float64 `gorm:"type:decimal(5,4)" json:"pilot_fee_rate"`    // 飞手分成比例
	PilotFee           int64   `json:"pilot_fee"`                                  // 飞手劳务费(分)
	OwnerFeeRate       float64 `gorm:"type:decimal(5,4)" json:"owner_fee_rate"`    // 机主分成比例
	OwnerFee           int64   `json:"owner_fee"`                                  // 机主设备费(分)
	InsuranceDeduction int64   `json:"insurance_deduction"`                        // 保险费代扣(分)

	// ==================== 参与方 ====================
	PilotUserID int64 `gorm:"index" json:"pilot_user_id"`
	OwnerUserID int64 `gorm:"index" json:"owner_user_id"`
	PayerUserID int64 `gorm:"index" json:"payer_user_id"` // 付款方(业主)

	// ==================== 定价参数 ====================
	FlightDistance   float64 `gorm:"type:decimal(10,2)" json:"flight_distance"`              // 飞行距离(km)
	FlightDuration   float64 `gorm:"type:decimal(10,2)" json:"flight_duration"`              // 飞行时长(分钟)
	CargoWeight      float64 `gorm:"type:decimal(10,2)" json:"cargo_weight"`                 // 货物重量(kg)
	DifficultyFactor float64 `gorm:"type:decimal(3,1);default:1.0" json:"difficulty_factor"` // 难度系数(1.0-2.0)
	CargoValue       int64   `json:"cargo_value"`                                            // 货物申报价值(分)
	InsuranceRate    float64 `gorm:"type:decimal(5,4)" json:"insurance_rate"`                // 保险费率

	// ==================== 状态管理 ====================
	Status       string     `gorm:"type:varchar(20);default:pending" json:"status"` // pending, calculated, confirmed, settled, disputed
	CalculatedAt *time.Time `json:"calculated_at"`
	ConfirmedAt  *time.Time `json:"confirmed_at"`
	SettledAt    *time.Time `json:"settled_at"`
	SettledBy    string     `gorm:"type:varchar(20)" json:"settled_by"` // system, admin
	Notes        string     `gorm:"type:text" json:"notes"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Order *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
}

func (OrderSettlement) TableName() string {
	return "order_settlements"
}

// UserWallet 用户钱包
type UserWallet struct {
	ID               int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID           int64     `gorm:"uniqueIndex;not null" json:"user_id"`
	WalletType       string    `gorm:"type:varchar(20);default:general" json:"wallet_type"` // general, pilot, owner
	AvailableBalance int64     `gorm:"default:0" json:"available_balance"`                  // 可用余额(分)
	FrozenBalance    int64     `gorm:"default:0" json:"frozen_balance"`                     // 冻结余额(分)
	TotalIncome      int64     `gorm:"default:0" json:"total_income"`                       // 累计收入(分)
	TotalWithdrawn   int64     `gorm:"default:0" json:"total_withdrawn"`                    // 累计提现(分)
	TotalFrozen      int64     `gorm:"default:0" json:"total_frozen"`                       // 累计冻结(分)
	Status           string    `gorm:"type:varchar(20);default:active" json:"status"`       // active, frozen, closed
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (UserWallet) TableName() string {
	return "user_wallets"
}

// WalletTransaction 钱包流水记录
type WalletTransaction struct {
	ID                  int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	TransactionNo       string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"transaction_no"`
	WalletID            int64     `gorm:"index;not null" json:"wallet_id"`
	UserID              int64     `gorm:"index;not null" json:"user_id"`
	Type                string    `gorm:"type:varchar(30);not null" json:"type"` // income, withdraw, freeze, unfreeze, deduct, refund
	Amount              int64     `json:"amount"`                                // 交易金额(分, 正为收入负为支出)
	BalanceBefore       int64     `json:"balance_before"`                        // 交易前余额(分)
	BalanceAfter        int64     `json:"balance_after"`                         // 交易后余额(分)
	RelatedOrderID      int64     `gorm:"index" json:"related_order_id"`
	RelatedSettlementID int64     `gorm:"index" json:"related_settlement_id"`
	Description         string    `gorm:"type:varchar(255)" json:"description"`
	CreatedAt           time.Time `json:"created_at"`
}

func (WalletTransaction) TableName() string {
	return "wallet_transactions"
}

// WithdrawalRecord 提现记录
type WithdrawalRecord struct {
	ID           int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	WithdrawalNo string `gorm:"type:varchar(50);uniqueIndex;not null" json:"withdrawal_no"`
	UserID       int64  `gorm:"index;not null" json:"user_id"`
	WalletID     int64  `gorm:"index;not null" json:"wallet_id"`
	Amount       int64  `json:"amount"`        // 提现金额(分)
	ServiceFee   int64  `json:"service_fee"`   // 手续费(分)
	ActualAmount int64  `json:"actual_amount"` // 实际到账(分)

	// 收款方式
	WithdrawMethod string `gorm:"type:varchar(20);not null" json:"withdraw_method"` // bank_card, alipay, wechat
	BankName       string `gorm:"type:varchar(50)" json:"bank_name"`
	BankBranch     string `gorm:"type:varchar(100)" json:"bank_branch"`
	AccountNo      string `gorm:"type:varchar(255)" json:"account_no"` // 加密存储
	AccountName    string `gorm:"type:varchar(50)" json:"account_name"`
	AlipayAccount  string `gorm:"type:varchar(100)" json:"alipay_account"`
	WechatAccount  string `gorm:"type:varchar(100)" json:"wechat_account"`

	// 状态
	Status       string     `gorm:"type:varchar(20);default:pending" json:"status"` // pending, processing, completed, rejected, failed
	ReviewedBy   int64      `json:"reviewed_by"`
	ReviewedAt   *time.Time `json:"reviewed_at"`
	ReviewNotes  string     `gorm:"type:varchar(255)" json:"review_notes"`
	CompletedAt  *time.Time `json:"completed_at"`
	ThirdPartyNo string     `gorm:"type:varchar(100)" json:"third_party_no"` // 第三方转账流水号
	FailReason   string     `gorm:"type:varchar(255)" json:"fail_reason"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (WithdrawalRecord) TableName() string {
	return "withdrawal_records"
}

// PricingConfig 定价配置
type PricingConfig struct {
	ID          int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	ConfigKey   string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"config_key"`
	ConfigValue float64   `gorm:"type:decimal(10,4)" json:"config_value"`
	Unit        string    `gorm:"type:varchar(20)" json:"unit"`
	Description string    `gorm:"type:varchar(255)" json:"description"`
	Category    string    `gorm:"type:varchar(30)" json:"category"` // base, mileage, duration, weight, difficulty, insurance, split, surge
	IsActive    bool      `gorm:"default:true" json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (PricingConfig) TableName() string {
	return "pricing_configs"
}

// ============================================================
// ==================== 阶段六：信用评价与风控 ====================
// ============================================================

// CreditScore 用户信用分 (1000分制)
type CreditScore struct {
	ID       int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID   int64  `gorm:"uniqueIndex;not null" json:"user_id"`
	UserType string `gorm:"type:varchar(20);not null" json:"user_type"` // pilot, owner, client

	// ==================== 总分 ====================
	TotalScore int    `gorm:"default:600" json:"total_score"`                     // 总信用分 0-1000
	ScoreLevel string `gorm:"type:varchar(20);default:normal" json:"score_level"` // excellent(>=800), good(>=700), normal(>=600), poor(>=400), bad(<400)

	// ==================== 飞手维度 (pilot) ====================
	PilotQualification int `gorm:"default:0" json:"pilot_qualification"` // 基础资质分 0-200
	PilotService       int `gorm:"default:0" json:"pilot_service"`       // 服务质量分 0-300
	PilotSafety        int `gorm:"default:0" json:"pilot_safety"`        // 安全记录分 0-300
	PilotActivity      int `gorm:"default:0" json:"pilot_activity"`      // 活跃度分 0-200

	// ==================== 机主维度 (owner) ====================
	OwnerCompliance  int `gorm:"default:0" json:"owner_compliance"`  // 设备合规分 0-250
	OwnerService     int `gorm:"default:0" json:"owner_service"`     // 服务质量分 0-300
	OwnerFulfillment int `gorm:"default:0" json:"owner_fulfillment"` // 履约能力分 0-250
	OwnerAttitude    int `gorm:"default:0" json:"owner_attitude"`    // 合作态度分 0-200

	// ==================== 业主/客户维度 (client) ====================
	ClientIdentity     int `gorm:"default:0" json:"client_identity"`      // 身份认证分 0-200
	ClientPayment      int `gorm:"default:0" json:"client_payment"`       // 支付能力分 0-300
	ClientAttitude     int `gorm:"default:0" json:"client_attitude"`      // 合作态度分 0-300
	ClientOrderQuality int `gorm:"default:0" json:"client_order_quality"` // 订单质量分 0-200

	// ==================== 统计数据 ====================
	TotalOrders     int        `gorm:"default:0" json:"total_orders"`                        // 总订单数
	CompletedOrders int        `gorm:"default:0" json:"completed_orders"`                    // 完成订单数
	CancelledOrders int        `gorm:"default:0" json:"cancelled_orders"`                    // 取消订单数
	DisputeOrders   int        `gorm:"default:0" json:"dispute_orders"`                      // 纠纷订单数
	AverageRating   float64    `gorm:"type:decimal(3,2);default:5.00" json:"average_rating"` // 平均评分
	TotalReviews    int        `gorm:"default:0" json:"total_reviews"`                       // 评价总数
	PositiveReviews int        `gorm:"default:0" json:"positive_reviews"`                    // 好评数
	NegativeReviews int        `gorm:"default:0" json:"negative_reviews"`                    // 差评数
	ViolationCount  int        `gorm:"default:0" json:"violation_count"`                     // 违规次数
	LastViolationAt *time.Time `json:"last_violation_at"`

	// ==================== 状态 ====================
	IsFrozen          bool       `gorm:"default:false" json:"is_frozen"` // 是否冻结
	FrozenReason      string     `gorm:"type:varchar(255)" json:"frozen_reason"`
	FrozenAt          *time.Time `json:"frozen_at"`
	IsBlacklisted     bool       `gorm:"default:false" json:"is_blacklisted"` // 是否黑名单
	BlacklistedReason string     `gorm:"type:varchar(255)" json:"blacklisted_reason"`
	BlacklistedAt     *time.Time `json:"blacklisted_at"`

	LastCalculatedAt *time.Time `json:"last_calculated_at"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (CreditScore) TableName() string {
	return "credit_scores"
}

// CreditScoreLog 信用分变动日志
type CreditScoreLog struct {
	ID              int64     `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID          int64     `gorm:"index;not null" json:"user_id"`
	ChangeType      string    `gorm:"type:varchar(30);not null" json:"change_type"` // order_complete, review_received, violation, bonus, penalty, recalculate
	ChangeReason    string    `gorm:"type:varchar(255)" json:"change_reason"`
	Dimension       string    `gorm:"type:varchar(30)" json:"dimension"` // qualification, service, safety, activity, compliance, fulfillment, attitude, identity, payment, order_quality
	ScoreBefore     int       `json:"score_before"`
	ScoreAfter      int       `json:"score_after"`
	ScoreChange     int       `json:"score_change"` // 正为增加，负为减少
	RelatedOrderID  int64     `gorm:"index" json:"related_order_id"`
	RelatedReviewID int64     `gorm:"index" json:"related_review_id"`
	OperatorID      int64     `json:"operator_id"`                           // 0表示系统自动
	OperatorType    string    `gorm:"type:varchar(20)" json:"operator_type"` // system, admin, auto
	Notes           string    `gorm:"type:text" json:"notes"`
	CreatedAt       time.Time `json:"created_at"`
}

func (CreditScoreLog) TableName() string {
	return "credit_score_logs"
}

// RiskControl 风控记录
type RiskControl struct {
	ID       int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	RiskNo   string `gorm:"type:varchar(50);uniqueIndex;not null" json:"risk_no"`
	UserID   int64  `gorm:"index;not null" json:"user_id"`
	UserType string `gorm:"type:varchar(20)" json:"user_type"`
	OrderID  int64  `gorm:"index" json:"order_id"`

	// 风控类型
	RiskPhase string `gorm:"type:varchar(20);not null" json:"risk_phase"`    // pre(事前), during(事中), post(事后)
	RiskType  string `gorm:"type:varchar(30);not null" json:"risk_type"`     // identity_fraud, payment_risk, behavior_abnormal, dispute, violation, blacklist
	RiskLevel string `gorm:"type:varchar(20);default:low" json:"risk_level"` // low, medium, high, critical
	RiskScore int    `gorm:"default:0" json:"risk_score"`                    // 风险评分 0-100

	// 风控详情
	TriggerRule string `gorm:"type:varchar(100)" json:"trigger_rule"` // 触发规则
	TriggerData string `gorm:"type:text" json:"trigger_data"`         // 触发数据(JSON)
	Description string `gorm:"type:text" json:"description"`

	// 处理状态
	Status       string     `gorm:"type:varchar(20);default:pending" json:"status"` // pending, reviewing, resolved, dismissed
	Action       string     `gorm:"type:varchar(30)" json:"action"`                 // none, warn, freeze, blacklist, block_order, require_deposit
	ActionDetail string     `gorm:"type:text" json:"action_detail"`
	ReviewedBy   int64      `json:"reviewed_by"`
	ReviewedAt   *time.Time `json:"reviewed_at"`
	ReviewNotes  string     `gorm:"type:text" json:"review_notes"`
	ResolvedAt   *time.Time `json:"resolved_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	User  *User  `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Order *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
}

func (RiskControl) TableName() string {
	return "risk_controls"
}

// Violation 违规记录
type Violation struct {
	ID          int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	ViolationNo string `gorm:"type:varchar(50);uniqueIndex;not null" json:"violation_no"`
	UserID      int64  `gorm:"index;not null" json:"user_id"`
	UserType    string `gorm:"type:varchar(20)" json:"user_type"`
	OrderID     int64  `gorm:"index" json:"order_id"`

	// 违规类型
	ViolationType  string `gorm:"type:varchar(30);not null" json:"violation_type"`       // cancel_abuse, no_show, delay, damage, fraud, unsafe_flight, policy_violation
	ViolationLevel string `gorm:"type:varchar(20);default:minor" json:"violation_level"` // minor(轻微), moderate(中等), serious(严重), critical(重大)
	Description    string `gorm:"type:text" json:"description"`
	Evidence       string `gorm:"type:text" json:"evidence"` // 证据(JSON: 图片/视频/日志)

	// 处罚
	Penalty        string `gorm:"type:varchar(30)" json:"penalty"` // warning, score_deduct, freeze_temp, freeze_perm, blacklist
	PenaltyDetail  string `gorm:"type:text" json:"penalty_detail"`
	ScoreDeduction int    `gorm:"default:0" json:"score_deduction"` // 扣除信用分
	FreezeDays     int    `gorm:"default:0" json:"freeze_days"`     // 冻结天数
	FineAmount     int64  `gorm:"default:0" json:"fine_amount"`     // 罚款金额(分)

	// 申诉
	AppealStatus     string     `gorm:"type:varchar(20);default:none" json:"appeal_status"` // none, pending, approved, rejected
	AppealContent    string     `gorm:"type:text" json:"appeal_content"`
	AppealAt         *time.Time `json:"appeal_at"`
	AppealReviewedBy int64      `json:"appeal_reviewed_by"`
	AppealReviewedAt *time.Time `json:"appeal_reviewed_at"`
	AppealResult     string     `gorm:"type:text" json:"appeal_result"`

	// 状态
	Status      string     `gorm:"type:varchar(20);default:pending" json:"status"` // pending, confirmed, appealing, revoked
	ConfirmedBy int64      `json:"confirmed_by"`
	ConfirmedAt *time.Time `json:"confirmed_at"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	User  *User  `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Order *Order `gorm:"foreignKey:OrderID" json:"order,omitempty"`
}

func (Violation) TableName() string {
	return "violations"
}

// Blacklist 黑名单
type Blacklist struct {
	ID                 int64      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID             int64      `gorm:"uniqueIndex;not null" json:"user_id"`
	UserType           string     `gorm:"type:varchar(20)" json:"user_type"`
	BlacklistType      string     `gorm:"type:varchar(20);default:permanent" json:"blacklist_type"` // temporary, permanent
	Reason             string     `gorm:"type:text;not null" json:"reason"`
	RelatedViolationID int64      `gorm:"index" json:"related_violation_id"`
	ExpireAt           *time.Time `json:"expire_at"` // 临时黑名单到期时间
	AddedBy            int64      `json:"added_by"`
	AddedAt            time.Time  `json:"added_at"`
	RemovedBy          int64      `json:"removed_by"`
	RemovedAt          *time.Time `json:"removed_at"`
	RemovedReason      string     `gorm:"type:varchar(255)" json:"removed_reason"`
	IsActive           bool       `gorm:"default:true" json:"is_active"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Blacklist) TableName() string {
	return "blacklists"
}

// Deposit 保证金
type Deposit struct {
	ID        int64  `gorm:"primaryKey;autoIncrement" json:"id"`
	DepositNo string `gorm:"type:varchar(50);uniqueIndex;not null" json:"deposit_no"`
	UserID    int64  `gorm:"index;not null" json:"user_id"`
	UserType  string `gorm:"type:varchar(20)" json:"user_type"` // pilot, owner, client

	// 金额
	RequiredAmount int64 `json:"required_amount"` // 应缴金额(分)
	PaidAmount     int64 `json:"paid_amount"`     // 已缴金额(分)
	FrozenAmount   int64 `json:"frozen_amount"`   // 冻结金额(分, 用于赔付)
	RefundedAmount int64 `json:"refunded_amount"` // 已退还金额(分)

	// 状态
	Status     string     `gorm:"type:varchar(20);default:pending" json:"status"` // pending, paid, partial, frozen, refunding, refunded
	PaidAt     *time.Time `json:"paid_at"`
	RefundedAt *time.Time `json:"refunded_at"`
	PaymentID  int64      `json:"payment_id"` // 关联支付记录

	// 原因
	RequireReason string `gorm:"type:varchar(255)" json:"require_reason"` // 要求缴纳原因
	RefundReason  string `gorm:"type:varchar(255)" json:"refund_reason"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

func (Deposit) TableName() string {
	return "deposits"
}

// ============================================================
// ==================== 阶段七：保险与理赔系统 ====================
// ============================================================
