package service

import (
	"testing"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

func TestSimulatedIDVerificationAutoApprovesPendingSubmission(t *testing.T) {
	db := newServiceTestDB(t, &model.User{})
	userRepo := repository.NewUserRepo(db)
	userService := NewUserService(userRepo, nil, nil, nil, nil)
	user := &model.User{
		Phone:      "13900001111",
		Nickname:   "实名测试",
		UserType:   "renter",
		IDVerified: "pending",
		IDCardNo:   "440100199001011234",
		Status:     "active",
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("create user: %v", err)
	}

	userService.scheduleSimulatedIDVerificationAutoApproval(user.ID, user.IDCardNo, 0)

	updated, err := userRepo.GetByID(user.ID)
	if err != nil {
		t.Fatalf("get updated user: %v", err)
	}
	if updated.IDVerified != "approved" {
		t.Fatalf("expected approved after simulated auto approval, got %q", updated.IDVerified)
	}
}

func TestSimulatedIDVerificationAutoApprovalDoesNotOverrideRejected(t *testing.T) {
	db := newServiceTestDB(t, &model.User{})
	userRepo := repository.NewUserRepo(db)
	userService := NewUserService(userRepo, nil, nil, nil, nil)
	user := &model.User{
		Phone:      "13900002222",
		Nickname:   "拒绝测试",
		UserType:   "renter",
		IDVerified: "rejected",
		IDCardNo:   "440100199001011235",
		Status:     "active",
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("create user: %v", err)
	}

	userService.scheduleSimulatedIDVerificationAutoApproval(user.ID, user.IDCardNo, 0)

	updated, err := userRepo.GetByID(user.ID)
	if err != nil {
		t.Fatalf("get updated user: %v", err)
	}
	if updated.IDVerified != "rejected" {
		t.Fatalf("expected rejected to be preserved, got %q", updated.IDVerified)
	}
}

func TestGetRoleSummaryBuildsPendingProviderSummaryForNewOnboarding(t *testing.T) {
	db := newServiceTestDB(t, &model.User{}, &model.ClientProfile{}, &model.OwnerProfile{}, &model.PilotProfile{})
	userRepo := repository.NewUserRepo(db)
	roleProfileRepo := repository.NewRoleProfileRepo(db)
	userService := NewUserService(userRepo, nil, roleProfileRepo, nil, nil)
	user := &model.User{
		Phone:    "13900003333",
		Nickname: "待审核服务商",
		UserType: "renter",
		Status:   "active",
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := roleProfileRepo.EnsureOwnerProfile(&model.OwnerProfile{
		UserID:             user.ID,
		VerificationStatus: "pending",
		Status:             "active",
		ServiceCity:        "深圳",
	}); err != nil {
		t.Fatalf("create owner profile: %v", err)
	}

	summary, err := userService.GetRoleSummary(user.ID)
	if err != nil {
		t.Fatalf("get role summary: %v", err)
	}
	if !summary.HasOwnerRole {
		t.Fatal("expected owner profile to keep compatibility owner role")
	}
	if summary.Provider.Status != providerStatusPendingReview || summary.Provider.NextAction != providerNextActionWaitReview {
		t.Fatalf("expected pending provider summary, got %#v", summary.Provider)
	}
	if summary.Provider.CanUseWorkbench || summary.CanPublishSupply {
		t.Fatalf("pending provider must not unlock formal workbench, got %#v", summary.Provider)
	}
}

func TestGetRoleSummaryRequiresAssetAndExecutorForProviderAccess(t *testing.T) {
	db := newServiceTestDB(t, &model.User{}, &model.ClientProfile{}, &model.OwnerProfile{}, &model.PilotProfile{}, &model.Pilot{}, &model.Drone{})
	userRepo := repository.NewUserRepo(db)
	roleProfileRepo := repository.NewRoleProfileRepo(db)
	droneRepo := repository.NewDroneRepo(db)
	pilotRepo := repository.NewPilotRepo(db)
	userService := NewUserService(userRepo, nil, roleProfileRepo, droneRepo, pilotRepo)
	user := &model.User{
		Phone:    "13900004444",
		Nickname: "设备服务商",
		UserType: "renter",
		Status:   "active",
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := droneRepo.Create(&model.Drone{
		OwnerID:               user.ID,
		Brand:                 "DJI",
		Model:                 "Heavy",
		SerialNumber:          "DR-PROVIDER-ROLE-001",
		MTOWKG:                model.HeavyLiftMinMTOWKG,
		MaxPayloadKG:          model.HeavyLiftMinPayloadKG,
		AvailabilityStatus:    "available",
		CertificationStatus:   "approved",
		UOMVerified:           "verified",
		InsuranceVerified:     "verified",
		AirworthinessVerified: "verified",
	}); err != nil {
		t.Fatalf("create drone: %v", err)
	}

	summary, err := userService.GetRoleSummary(user.ID)
	if err != nil {
		t.Fatalf("get role summary: %v", err)
	}
	if summary.Provider.Status != providerStatusPendingReview || summary.Provider.AssetStatus != providerStatusApproved {
		t.Fatalf("expected approved asset provider, got %#v", summary.Provider)
	}
	if summary.Provider.CanUseWorkbench || summary.Provider.CanQuote || summary.Provider.CanArrangeDispatch || summary.CanPublishSupply {
		t.Fatalf("asset-only provider must not unlock formal operations, got %#v", summary.Provider)
	}

	if err := pilotRepo.Create(&model.Pilot{
		UserID:             user.ID,
		VerificationStatus: "verified",
		AvailabilityStatus: "offline",
	}); err != nil {
		t.Fatalf("create pilot: %v", err)
	}
	summary, err = userService.GetRoleSummary(user.ID)
	if err != nil {
		t.Fatalf("get role summary after executor approval: %v", err)
	}
	if !summary.Provider.CanUseWorkbench || !summary.Provider.CanQuote || !summary.Provider.CanArrangeDispatch || !summary.Provider.CanSelfExecute || !summary.CanPublishSupply || !summary.CanSelfExecute {
		t.Fatalf("asset and executor approval must unlock unified provider operations, got %#v", summary.Provider)
	}
	if summary.Provider.CanAcceptDispatch || summary.CanAcceptDispatch {
		t.Fatalf("offline executor must not accept dispatch, got %#v", summary.Provider)
	}
}

func TestGetRoleSummaryExecutorOnlyDoesNotUnlockWorkbench(t *testing.T) {
	db := newServiceTestDB(t, &model.User{}, &model.Pilot{})
	userRepo := repository.NewUserRepo(db)
	pilotRepo := repository.NewPilotRepo(db)
	userService := NewUserService(userRepo, nil, nil, nil, pilotRepo)
	user := &model.User{
		Phone:    "13900005555",
		Nickname: "离线执行人员",
		UserType: "renter",
		Status:   "active",
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("create user: %v", err)
	}
	if err := pilotRepo.Create(&model.Pilot{
		UserID:             user.ID,
		VerificationStatus: "verified",
		AvailabilityStatus: "offline",
	}); err != nil {
		t.Fatalf("create pilot: %v", err)
	}

	summary, err := userService.GetRoleSummary(user.ID)
	if err != nil {
		t.Fatalf("get role summary: %v", err)
	}
	if summary.Provider.Status != providerStatusPendingReview || summary.Provider.ExecutorStatus != providerStatusApproved {
		t.Fatalf("expected approved executor provider, got %#v", summary.Provider)
	}
	if summary.Provider.CanUseWorkbench || summary.Provider.CanQuote || summary.Provider.CanSelfExecute {
		t.Fatalf("executor-only provider must not unlock formal workbench, got %#v", summary.Provider)
	}
	if summary.Provider.CanAcceptDispatch || summary.CanAcceptDispatch {
		t.Fatalf("offline executor must not accept dispatch, got %#v", summary.Provider)
	}
}
