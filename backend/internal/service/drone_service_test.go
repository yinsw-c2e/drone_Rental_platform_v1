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

func TestApproveCertificationRequiresFullQualificationOrForce(t *testing.T) {
	t.Run("三项齐全直接通过", func(t *testing.T) {
		db := newServiceTestDB(t, &model.Drone{})
		drone := &model.Drone{
			OwnerID:               801,
			Brand:                 "DJI",
			Model:                 "FlyCart",
			SerialNumber:          "SN-CERT-001",
			CertificationStatus:   "pending",
			UOMVerified:           "verified",
			InsuranceVerified:     "verified",
			AirworthinessVerified: "verified",
		}
		if err := db.Create(drone).Error; err != nil {
			t.Fatalf("create drone: %v", err)
		}

		service := &DroneService{droneRepo: repository.NewDroneRepo(db)}
		if err := service.ApproveCertification(drone.ID, 42, true, false, ""); err != nil {
			t.Fatalf("approve certification: %v", err)
		}

		var updated model.Drone
		if err := db.First(&updated, drone.ID).Error; err != nil {
			t.Fatalf("reload drone: %v", err)
		}
		if updated.CertificationStatus != "approved" {
			t.Fatalf("expected approved status, got %s", updated.CertificationStatus)
		}
		if updated.CertificationReviewedAt == nil || updated.CertificationReviewedBy != 42 || updated.CertificationForceApproved || updated.CertificationOverrideReason != "" {
			t.Fatalf("unexpected certification metadata: %#v", updated)
		}
	})

	t.Run("缺一项不允许通过", func(t *testing.T) {
		db := newServiceTestDB(t, &model.Drone{})
		drone := &model.Drone{
			OwnerID:               801,
			Brand:                 "DJI",
			Model:                 "FlyCart",
			SerialNumber:          "SN-CERT-002",
			CertificationStatus:   "pending",
			UOMVerified:           "pending",
			InsuranceVerified:     "verified",
			AirworthinessVerified: "verified",
		}
		if err := db.Create(drone).Error; err != nil {
			t.Fatalf("create drone: %v", err)
		}

		service := &DroneService{droneRepo: repository.NewDroneRepo(db)}
		if err := service.ApproveCertification(drone.ID, 42, true, false, ""); err == nil {
			t.Fatal("expected missing qualification error")
		}

		var updated model.Drone
		if err := db.First(&updated, drone.ID).Error; err != nil {
			t.Fatalf("reload drone: %v", err)
		}
		if updated.CertificationStatus != "pending" {
			t.Fatalf("expected certification status to remain pending, got %s", updated.CertificationStatus)
		}
	})

	t.Run("强制通过缺原因", func(t *testing.T) {
		db := newServiceTestDB(t, &model.Drone{})
		drone := &model.Drone{
			OwnerID:               801,
			Brand:                 "DJI",
			Model:                 "FlyCart",
			SerialNumber:          "SN-CERT-003",
			CertificationStatus:   "pending",
			UOMVerified:           "pending",
			InsuranceVerified:     "verified",
			AirworthinessVerified: "verified",
		}
		if err := db.Create(drone).Error; err != nil {
			t.Fatalf("create drone: %v", err)
		}

		service := &DroneService{droneRepo: repository.NewDroneRepo(db)}
		if err := service.ApproveCertification(drone.ID, 42, true, true, ""); err == nil {
			t.Fatal("expected override reason error")
		}
	})

	t.Run("强制通过原因太短", func(t *testing.T) {
		db := newServiceTestDB(t, &model.Drone{})
		drone := &model.Drone{
			OwnerID:               801,
			Brand:                 "DJI",
			Model:                 "FlyCart",
			SerialNumber:          "SN-CERT-004",
			CertificationStatus:   "pending",
			UOMVerified:           "pending",
			InsuranceVerified:     "verified",
			AirworthinessVerified: "verified",
		}
		if err := db.Create(drone).Error; err != nil {
			t.Fatalf("create drone: %v", err)
		}

		service := &DroneService{droneRepo: repository.NewDroneRepo(db)}
		if err := service.ApproveCertification(drone.ID, 42, true, true, "不齐"); err == nil {
			t.Fatal("expected short override reason error")
		}
	})

	t.Run("强制通过合法", func(t *testing.T) {
		db := newServiceTestDB(t, &model.Drone{})
		drone := &model.Drone{
			OwnerID:               801,
			Brand:                 "DJI",
			Model:                 "FlyCart",
			SerialNumber:          "SN-CERT-005",
			CertificationStatus:   "pending",
			UOMVerified:           "pending",
			InsuranceVerified:     "verified",
			AirworthinessVerified: "verified",
		}
		if err := db.Create(drone).Error; err != nil {
			t.Fatalf("create drone: %v", err)
		}

		service := &DroneService{droneRepo: repository.NewDroneRepo(db)}
		if err := service.ApproveCertification(drone.ID, 42, true, true, "临时活动需放行"); err != nil {
			t.Fatalf("force approve certification: %v", err)
		}

		var updated model.Drone
		if err := db.First(&updated, drone.ID).Error; err != nil {
			t.Fatalf("reload drone: %v", err)
		}
		if updated.CertificationStatus != "approved" {
			t.Fatalf("expected approved status, got %s", updated.CertificationStatus)
		}
		if updated.CertificationReviewedAt == nil || updated.CertificationReviewedBy != 42 || !updated.CertificationForceApproved || updated.CertificationOverrideReason != "临时活动需放行" {
			t.Fatalf("unexpected force approval metadata: %#v", updated)
		}
	})
}

func TestAutoElevateAndRevertCertificationOnSubQualifications(t *testing.T) {
	t.Run("三项变 verified 后自动升级", func(t *testing.T) {
		db := newServiceTestDB(t, &model.Drone{})
		drone := &model.Drone{
			OwnerID:               801,
			Brand:                 "DJI",
			Model:                 "FlyCart",
			SerialNumber:          "SN-AUTO-CERT-001",
			CertificationStatus:   "pending",
			UOMVerified:           "verified",
			InsuranceVerified:     "verified",
			AirworthinessVerified: "pending",
		}
		if err := db.Create(drone).Error; err != nil {
			t.Fatalf("create drone: %v", err)
		}

		service := &DroneService{droneRepo: repository.NewDroneRepo(db)}
		if err := service.ApproveAirworthiness(drone.ID, true); err != nil {
			t.Fatalf("approve airworthiness: %v", err)
		}

		updated, err := service.GetByID(drone.ID)
		if err != nil {
			t.Fatalf("reload drone: %v", err)
		}
		if updated.CertificationStatus != "approved" {
			t.Fatalf("expected approved status, got %s", updated.CertificationStatus)
		}
		if updated.CertificationReviewedBy != 0 || updated.CertificationForceApproved {
			t.Fatalf("unexpected certification metadata: %#v", updated)
		}
	})

	t.Run("保险被拒后已 approved 的自动撤回到 pending", func(t *testing.T) {
		db := newServiceTestDB(t, &model.Drone{})
		drone := &model.Drone{
			OwnerID:               801,
			Brand:                 "DJI",
			Model:                 "FlyCart",
			SerialNumber:          "SN-AUTO-CERT-002",
			CertificationStatus:   "approved",
			UOMVerified:           "verified",
			InsuranceVerified:     "verified",
			AirworthinessVerified: "verified",
		}
		if err := db.Create(drone).Error; err != nil {
			t.Fatalf("create drone: %v", err)
		}

		service := &DroneService{droneRepo: repository.NewDroneRepo(db)}
		if err := service.ApproveInsurance(drone.ID, 42, false, "保单过期"); err != nil {
			t.Fatalf("reject insurance: %v", err)
		}

		updated, err := service.GetByID(drone.ID)
		if err != nil {
			t.Fatalf("reload drone: %v", err)
		}
		if updated.CertificationStatus != "pending" {
			t.Fatalf("expected pending status, got %s", updated.CertificationStatus)
		}
		if updated.InsuranceVerified != "rejected" {
			t.Fatalf("expected rejected insurance, got %s", updated.InsuranceVerified)
		}
	})

	t.Run("force_approved=true 的 drone 不被撤回", func(t *testing.T) {
		db := newServiceTestDB(t, &model.Drone{})
		drone := &model.Drone{
			OwnerID:                     801,
			Brand:                       "DJI",
			Model:                       "FlyCart",
			SerialNumber:                "SN-AUTO-CERT-003",
			CertificationStatus:         "approved",
			CertificationForceApproved:  true,
			CertificationOverrideReason: "临时活动放行",
			UOMVerified:                 "verified",
			InsuranceVerified:           "verified",
			AirworthinessVerified:       "verified",
		}
		if err := db.Create(drone).Error; err != nil {
			t.Fatalf("create drone: %v", err)
		}

		service := &DroneService{droneRepo: repository.NewDroneRepo(db)}
		if err := service.ApproveInsurance(drone.ID, 42, false, "保单过期"); err != nil {
			t.Fatalf("reject insurance: %v", err)
		}

		updated, err := service.GetByID(drone.ID)
		if err != nil {
			t.Fatalf("reload drone: %v", err)
		}
		if updated.CertificationStatus != "approved" {
			t.Fatalf("expected approved status to remain, got %s", updated.CertificationStatus)
		}
		if updated.CertificationOverrideReason != "临时活动放行" {
			t.Fatalf("expected override reason to remain, got %s", updated.CertificationOverrideReason)
		}
		if updated.InsuranceVerified != "rejected" {
			t.Fatalf("expected rejected insurance, got %s", updated.InsuranceVerified)
		}
	})

	t.Run("三项中只有两项 verified 时不升级", func(t *testing.T) {
		db := newServiceTestDB(t, &model.Drone{})
		drone := &model.Drone{
			OwnerID:               801,
			Brand:                 "DJI",
			Model:                 "FlyCart",
			SerialNumber:          "SN-AUTO-CERT-004",
			CertificationStatus:   "pending",
			UOMVerified:           "verified",
			InsuranceVerified:     "verified",
			AirworthinessVerified: "pending",
		}
		if err := db.Create(drone).Error; err != nil {
			t.Fatalf("create drone: %v", err)
		}

		service := &DroneService{droneRepo: repository.NewDroneRepo(db)}
		if err := service.ApproveUOMRegistration(drone.ID, true); err != nil {
			t.Fatalf("approve uom: %v", err)
		}

		updated, err := service.GetByID(drone.ID)
		if err != nil {
			t.Fatalf("reload drone: %v", err)
		}
		if updated.CertificationStatus != "pending" {
			t.Fatalf("expected pending status, got %s", updated.CertificationStatus)
		}
	})

	t.Run("三项变 verified 后但已经是 approved 不重复升", func(t *testing.T) {
		db := newServiceTestDB(t, &model.Drone{})
		drone := &model.Drone{
			OwnerID:                 801,
			Brand:                   "DJI",
			Model:                   "FlyCart",
			SerialNumber:            "SN-AUTO-CERT-005",
			CertificationStatus:     "approved",
			CertificationReviewedBy: 99,
			UOMVerified:             "verified",
			InsuranceVerified:       "verified",
			AirworthinessVerified:   "verified",
		}
		if err := db.Create(drone).Error; err != nil {
			t.Fatalf("create drone: %v", err)
		}

		service := &DroneService{droneRepo: repository.NewDroneRepo(db)}
		if err := service.ApproveAirworthiness(drone.ID, true); err != nil {
			t.Fatalf("approve airworthiness: %v", err)
		}

		updated, err := service.GetByID(drone.ID)
		if err != nil {
			t.Fatalf("reload drone: %v", err)
		}
		if updated.CertificationReviewedBy != 99 {
			t.Fatalf("expected reviewed by to remain 99, got %d", updated.CertificationReviewedBy)
		}
	})
}
