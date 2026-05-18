package repository

import (
	"testing"
	"time"

	"wurenji-backend/internal/model"
)

func TestAdminFacadeRepositoryListsFilterAndPage(t *testing.T) {
	db := newRepositoryTestDB(
		t,
		&model.User{},
		&model.Pilot{},
		&model.Drone{},
		&model.Order{},
		&model.Payment{},
		&model.Refund{},
		&model.DisputeRecord{},
		&model.AirspaceApplication{},
		&model.WithdrawalRecord{},
	)

	airspaceRepo := NewAirspaceRepo(db)
	settlementRepo := NewSettlementRepo(db)
	artifactRepo := NewOrderArtifactRepo(db)
	now := time.Now()

	if err := db.Create(&model.AirspaceApplication{PilotID: 1, DroneID: 1, FlightPlanName: "AS-1", FlightPurpose: "cargo_delivery", PlannedAltitude: 120, MaxAltitude: 150, PlannedStartTime: now, PlannedEndTime: now.Add(time.Hour), Status: "pending_review"}).Error; err != nil {
		t.Fatalf("seed airspace app: %v", err)
	}
	if err := db.Create(&model.AirspaceApplication{PilotID: 1, DroneID: 2, FlightPlanName: "AS-2", FlightPurpose: "cargo_delivery", PlannedAltitude: 120, MaxAltitude: 150, PlannedStartTime: now, PlannedEndTime: now.Add(time.Hour), Status: "approved"}).Error; err != nil {
		t.Fatalf("seed approved airspace app: %v", err)
	}
	apps, total, err := airspaceRepo.ListApplications("pending_review", 1, 20)
	if err != nil {
		t.Fatalf("list airspace apps: %v", err)
	}
	if total != 1 || len(apps) != 1 || apps[0].FlightPlanName != "AS-1" {
		t.Fatalf("unexpected airspace app result total=%d list=%#v", total, apps)
	}

	if err := db.Create(&model.WithdrawalRecord{WithdrawalNo: "WD-1", UserID: 10, WalletID: 1, Amount: 1000, Status: "pending"}).Error; err != nil {
		t.Fatalf("seed withdrawal: %v", err)
	}
	if err := db.Create(&model.WithdrawalRecord{WithdrawalNo: "WD-2", UserID: 11, WalletID: 2, Amount: 2000, Status: "completed"}).Error; err != nil {
		t.Fatalf("seed completed withdrawal: %v", err)
	}
	withdrawals, total, err := settlementRepo.ListWithdrawals("pending", 1, 20)
	if err != nil {
		t.Fatalf("list withdrawals: %v", err)
	}
	if total != 1 || len(withdrawals) != 1 || withdrawals[0].WithdrawalNo != "WD-1" {
		t.Fatalf("unexpected withdrawal result total=%d list=%#v", total, withdrawals)
	}

	if err := db.Create(&model.Order{OrderNo: "ORD-1", Status: "pending_payment"}).Error; err != nil {
		t.Fatalf("seed order: %v", err)
	}
	if err := db.Create(&model.Payment{PaymentNo: "PAY-1", OrderID: 1, UserID: 10, Amount: 1000, Status: "paid"}).Error; err != nil {
		t.Fatalf("seed payment: %v", err)
	}
	if err := db.Create(&model.Refund{RefundNo: "RF-1", OrderID: 1, PaymentID: 1, Amount: 1000, Status: "pending"}).Error; err != nil {
		t.Fatalf("seed refund: %v", err)
	}
	if err := db.Create(&model.DisputeRecord{OrderID: 1, InitiatorUserID: 10, DisputeType: "service", Status: "open", Summary: "late"}).Error; err != nil {
		t.Fatalf("seed dispute: %v", err)
	}

	refunds, total, err := artifactRepo.ListRefunds("pending", 1, 20)
	if err != nil {
		t.Fatalf("list refunds: %v", err)
	}
	if total != 1 || len(refunds) != 1 || refunds[0].RefundNo != "RF-1" {
		t.Fatalf("unexpected refund result total=%d list=%#v", total, refunds)
	}

	disputes, total, err := artifactRepo.ListDisputes("open", 1, 20)
	if err != nil {
		t.Fatalf("list disputes: %v", err)
	}
	if total != 1 || len(disputes) != 1 || disputes[0].Summary != "late" {
		t.Fatalf("unexpected dispute result total=%d list=%#v", total, disputes)
	}
}
