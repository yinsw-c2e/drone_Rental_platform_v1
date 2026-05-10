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
