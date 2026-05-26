package service

import (
	"strings"
	"testing"
	"time"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

func TestSubmitInsuranceResetsPreviousReviewResult(t *testing.T) {
	db := newServiceTestDB(t, &model.Drone{})
	reviewedAt := time.Now().Add(-24 * time.Hour)
	expireAt := time.Now().AddDate(1, 0, 0)
	drone := &model.Drone{
		OwnerID:               801,
		Brand:                 "DJI",
		Model:                 "FlyCart",
		SerialNumber:          "SN-INS-001",
		InsuranceVerified:     "rejected",
		InsuranceReviewedAt:   &reviewedAt,
		InsuranceReviewedBy:   1,
		InsuranceRejectReason: "旧保单已过期",
	}
	if err := db.Create(drone).Error; err != nil {
		t.Fatalf("create drone: %v", err)
	}

	service := &DroneService{droneRepo: repository.NewDroneRepo(db)}
	if err := service.SubmitInsurance(drone.OwnerID, drone.ID, &SubmitInsuranceReq{
		PolicyNo:         "P-INS-001",
		InsuranceCompany: "平安保险",
		CoverageAmount:   50000000,
		ExpireDate:       &expireAt,
		InsuranceDoc:     "/uploads/drone/policy.png",
	}); err != nil {
		t.Fatalf("submit insurance: %v", err)
	}

	var updated model.Drone
	if err := db.First(&updated, drone.ID).Error; err != nil {
		t.Fatalf("reload drone: %v", err)
	}
	if updated.InsuranceVerified != "pending" {
		t.Fatalf("expected pending status, got %s", updated.InsuranceVerified)
	}
	if updated.InsuranceReviewedAt != nil || updated.InsuranceReviewedBy != 0 || updated.InsuranceRejectReason != "" {
		t.Fatalf("expected previous review result to be cleared, got %#v", updated)
	}
}

func TestApproveInsuranceRecordsReviewerAndRejectReason(t *testing.T) {
	db := newServiceTestDB(t, &model.Drone{})
	drone := &model.Drone{
		OwnerID:           801,
		Brand:             "DJI",
		Model:             "FlyCart",
		SerialNumber:      "SN-INS-002",
		InsuranceVerified: "pending",
	}
	if err := db.Create(drone).Error; err != nil {
		t.Fatalf("create drone: %v", err)
	}

	service := &DroneService{droneRepo: repository.NewDroneRepo(db)}
	err := service.ApproveInsurance(drone.ID, 1, false, "")
	if err == nil || !strings.Contains(err.Error(), "原因") {
		t.Fatalf("expected rejection reason error, got %v", err)
	}

	if err := service.ApproveInsurance(drone.ID, 1, false, "保单截图不清晰"); err != nil {
		t.Fatalf("reject insurance: %v", err)
	}

	var rejected model.Drone
	if err := db.First(&rejected, drone.ID).Error; err != nil {
		t.Fatalf("reload rejected drone: %v", err)
	}
	if rejected.InsuranceVerified != "rejected" {
		t.Fatalf("expected rejected status, got %s", rejected.InsuranceVerified)
	}
	if rejected.InsuranceReviewedAt == nil || rejected.InsuranceReviewedBy != 1 || rejected.InsuranceRejectReason != "保单截图不清晰" {
		t.Fatalf("unexpected rejection metadata: %#v", rejected)
	}

	if err := service.ApproveInsurance(drone.ID, 2, true, ""); err != nil {
		t.Fatalf("approve insurance: %v", err)
	}

	var approved model.Drone
	if err := db.First(&approved, drone.ID).Error; err != nil {
		t.Fatalf("reload approved drone: %v", err)
	}
	if approved.InsuranceVerified != "verified" {
		t.Fatalf("expected verified status, got %s", approved.InsuranceVerified)
	}
	if approved.InsuranceReviewedAt == nil || approved.InsuranceReviewedBy != 2 || approved.InsuranceRejectReason != "" {
		t.Fatalf("unexpected approval metadata: %#v", approved)
	}
}
