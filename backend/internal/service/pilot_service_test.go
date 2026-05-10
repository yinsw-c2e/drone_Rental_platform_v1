package service

import (
	"testing"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

func TestBuildPilotEligibilityViewAllowsCandidateDuringPendingVerification(t *testing.T) {
	pilot := &model.Pilot{
		UserID:             7,
		CAACLicenseNo:      "CAAC-001",
		CAACLicenseType:    "VLOS",
		CAACLicenseImage:   "/uploads/pilot-license.jpg",
		VerificationStatus: "pending",
		AvailabilityStatus: "offline",
	}

	view := buildPilotEligibilityView(pilot, nil)
	if view == nil {
		t.Fatal("expected eligibility view")
	}
	if !view.CanApplyCandidate {
		t.Fatalf("expected pending pilot to be candidate-ready, got %#v", view)
	}
	if view.CanAcceptDispatch {
		t.Fatalf("expected pending pilot to still block formal dispatch, got %#v", view)
	}
	if view.Tier != "candidate_ready" {
		t.Fatalf("expected candidate_ready tier, got %s", view.Tier)
	}
}

func TestBuildPilotEligibilityViewBlocksRejectedPilot(t *testing.T) {
	pilot := &model.Pilot{
		UserID:             8,
		CAACLicenseNo:      "CAAC-002",
		CAACLicenseType:    "VLOS",
		CAACLicenseImage:   "/uploads/pilot-license.jpg",
		VerificationStatus: "rejected",
	}

	view := buildPilotEligibilityView(pilot, nil)
	if view == nil {
		t.Fatal("expected eligibility view")
	}
	if view.CanApplyCandidate || view.CanAcceptDispatch {
		t.Fatalf("expected rejected pilot to be blocked, got %#v", view)
	}
	if len(view.Blockers) == 0 || view.Blockers[0].Code != "pilot_verification_rejected" {
		t.Fatalf("expected rejection blocker, got %#v", view.Blockers)
	}
}

func TestApplyDemandCandidateAllowsPendingPilotWithBasicProfile(t *testing.T) {
	db := newServiceTestDB(t,
		&model.User{},
		&model.Pilot{},
		&model.PilotProfile{},
		&model.Demand{},
		&model.DemandCandidatePilot{},
	)

	userRepo := repository.NewUserRepo(db)
	pilotRepo := repository.NewPilotRepo(db)
	roleProfileRepo := repository.NewRoleProfileRepo(db)
	demandRepo := repository.NewDemandDomainRepo(db)

	user := &model.User{ID: 51, Phone: "13800000051", Nickname: "待审核飞手", Status: "active"}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("create user: %v", err)
	}

	pilot := &model.Pilot{
		UserID:             user.ID,
		CAACLicenseNo:      "CAAC-003",
		CAACLicenseType:    "VLOS",
		CAACLicenseImage:   "/uploads/pilot-license.jpg",
		VerificationStatus: "pending",
		AvailabilityStatus: "offline",
		ServiceRadius:      50,
	}
	if err := pilotRepo.Create(pilot); err != nil {
		t.Fatalf("create pilot: %v", err)
	}

	demand := &model.Demand{
		DemandNo:             "DM202604140001",
		ClientUserID:         1001,
		Title:                "山区吊运任务",
		ServiceType:          defaultDemandServiceType,
		CargoScene:           "mountain_agriculture",
		Status:               "published",
		AllowsPilotCandidate: true,
	}
	if err := demandRepo.CreateDemand(demand); err != nil {
		t.Fatalf("create demand: %v", err)
	}

	service := NewPilotService(
		pilotRepo,
		userRepo,
		roleProfileRepo,
		nil,
		nil,
		demandRepo,
		nil,
		nil,
		nil,
	)

	candidate, err := service.ApplyDemandCandidate(user.ID, demand.ID)
	if err != nil {
		t.Fatalf("apply demand candidate: %v", err)
	}
	if candidate == nil || candidate.Status != "active" {
		t.Fatalf("expected active candidate, got %#v", candidate)
	}
}

func TestUpsertCurrentProfileSyncsServiceBaseToRoleProfile(t *testing.T) {
	db := newServiceTestDB(t,
		&model.User{},
		&model.Pilot{},
		&model.PilotProfile{},
	)

	userRepo := repository.NewUserRepo(db)
	pilotRepo := repository.NewPilotRepo(db)
	roleProfileRepo := repository.NewRoleProfileRepo(db)

	user := &model.User{ID: 61, Phone: "13800000061", Nickname: "飞手设置自测", Status: "active"}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("create user: %v", err)
	}

	pilot := &model.Pilot{
		UserID:               user.ID,
		CAACLicenseNo:        "CAAC-061",
		CAACLicenseType:      "VLOS",
		CAACLicenseImage:     "/uploads/pilot-license.jpg",
		VerificationStatus:   "verified",
		AvailabilityStatus:   "online",
		ServiceRadius:        80,
		CurrentCity:          "佛山",
		ServiceBaseAddress:   "旧服务点",
		ServiceBaseLatitude:  23.0219,
		ServiceBaseLongitude: 113.1219,
	}
	if err := pilotRepo.Create(pilot); err != nil {
		t.Fatalf("create pilot: %v", err)
	}
	if err := roleProfileRepo.EnsurePilotProfile(&model.PilotProfile{
		UserID:               user.ID,
		ServiceRadiusKM:      80,
		ServiceBaseAddress:   "旧服务点",
		ServiceBaseLatitude:  23.0219,
		ServiceBaseLongitude: 113.1219,
	}); err != nil {
		t.Fatalf("create pilot profile: %v", err)
	}

	service := NewPilotService(
		pilotRepo,
		userRepo,
		roleProfileRepo,
		nil,
		nil,
		nil,
		nil,
		nil,
		nil,
	)
	radius := 50.0
	lat := 23.05935
	lng := 113.11939
	view, err := service.UpsertCurrentProfile(user.ID, &PilotProfileInput{
		CurrentCity:          "北京",
		ServiceRadius:        &radius,
		ServiceBaseAddress:   "禅城区澜石路附近",
		ServiceBaseLatitude:  &lat,
		ServiceBaseLongitude: &lng,
		SpecialSkills:        []string{"电网吊运", "应急救援"},
	})
	if err != nil {
		t.Fatalf("upsert profile: %v", err)
	}
	if view.ServiceBaseAddress != "禅城区澜石路附近" || view.ServiceBaseLatitude != lat || view.ServiceBaseLongitude != lng {
		t.Fatalf("expected updated service base in response, got %#v", view)
	}
	if view.ServiceRadiusKM != 50 {
		t.Fatalf("expected service radius km 50, got %d", view.ServiceRadiusKM)
	}

	updatedProfile, err := roleProfileRepo.GetPilotProfileByUserID(user.ID)
	if err != nil {
		t.Fatalf("load role profile: %v", err)
	}
	if updatedProfile.ServiceBaseAddress != "禅城区澜石路附近" ||
		updatedProfile.ServiceBaseLatitude != lat ||
		updatedProfile.ServiceBaseLongitude != lng ||
		updatedProfile.ServiceRadiusKM != 50 {
		t.Fatalf("expected synced role profile, got %#v", updatedProfile)
	}
}
