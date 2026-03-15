package repository

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"wurenji-backend/internal/model"
)

type OrderArtifactRepo struct {
	db *gorm.DB
}

func NewOrderArtifactRepo(db *gorm.DB) *OrderArtifactRepo {
	return &OrderArtifactRepo{db: db}
}

func (r *OrderArtifactRepo) DB() *gorm.DB {
	return r.db
}

func (r *OrderArtifactRepo) UpsertSnapshot(orderID int64, snapshotType string, data model.JSON) error {
	if orderID == 0 || snapshotType == "" {
		return nil
	}

	var existing model.OrderSnapshot
	err := r.db.Where("order_id = ? AND snapshot_type = ?", orderID, snapshotType).First(&existing).Error
	if err == nil {
		return r.db.Model(&model.OrderSnapshot{}).
			Where("id = ?", existing.ID).
			Updates(map[string]interface{}{
				"snapshot_data": data,
				"updated_at":    time.Now(),
			}).Error
	}
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	return r.db.Create(&model.OrderSnapshot{
		OrderID:      orderID,
		SnapshotType: snapshotType,
		SnapshotData: data,
	}).Error
}

func (r *OrderArtifactRepo) CreateRefund(refund *model.Refund) error {
	return r.db.Create(refund).Error
}

func (r *OrderArtifactRepo) UpdateRefund(refund *model.Refund) error {
	return r.db.Save(refund).Error
}

func (r *OrderArtifactRepo) GetRefundByPaymentID(paymentID int64) (*model.Refund, error) {
	var refund model.Refund
	err := r.db.Where("payment_id = ?", paymentID).First(&refund).Error
	if err != nil {
		return nil, err
	}
	return &refund, nil
}

func (r *OrderArtifactRepo) ListRefundsByOrder(orderID int64) ([]model.Refund, error) {
	var refunds []model.Refund
	err := r.db.Where("order_id = ?", orderID).Order("created_at DESC").Find(&refunds).Error
	return refunds, err
}

func (r *OrderArtifactRepo) ListSnapshotsByOrder(orderID int64) ([]model.OrderSnapshot, error) {
	var snapshots []model.OrderSnapshot
	err := r.db.Where("order_id = ?", orderID).Order("snapshot_type ASC").Find(&snapshots).Error
	return snapshots, err
}

func (r *OrderArtifactRepo) ListDisputesByOrder(orderID int64) ([]model.DisputeRecord, error) {
	var disputes []model.DisputeRecord
	err := r.db.Where("order_id = ? AND deleted_at IS NULL", orderID).Order("created_at DESC").Find(&disputes).Error
	return disputes, err
}

func (r *OrderArtifactRepo) CreateDispute(record *model.DisputeRecord) error {
	return r.db.Create(record).Error
}

func UpsertOrderSnapshotBundle(r *OrderArtifactRepo, order *model.Order, demand *model.Demand, supply *model.OwnerSupply) error {
	if r == nil || order == nil {
		return nil
	}

	if err := r.UpsertSnapshot(order.ID, "client", BuildClientSnapshot(order)); err != nil {
		return err
	}
	if err := r.UpsertSnapshot(order.ID, "pricing", BuildPricingSnapshot(order)); err != nil {
		return err
	}
	if err := r.UpsertSnapshot(order.ID, "execution", BuildExecutionSnapshot(order)); err != nil {
		return err
	}
	if demand != nil {
		if err := r.UpsertSnapshot(order.ID, "demand", BuildDemandSnapshot(demand)); err != nil {
			return err
		}
	}
	if supply != nil {
		if err := r.UpsertSnapshot(order.ID, "supply", BuildSupplySnapshot(supply)); err != nil {
			return err
		}
	}

	return nil
}

func BuildClientSnapshot(order *model.Order) model.JSON {
	return mustArtifactJSON(map[string]interface{}{
		"renter_id":        order.RenterID,
		"client_id":        order.ClientID,
		"client_user_id":   order.ClientUserID,
		"order_source":     order.OrderSource,
		"provider_user_id": order.ProviderUserID,
	})
}

func BuildPricingSnapshot(order *model.Order) model.JSON {
	return mustArtifactJSON(map[string]interface{}{
		"total_amount":             order.TotalAmount,
		"deposit_amount":           order.DepositAmount,
		"platform_commission_rate": order.PlatformCommissionRate,
		"platform_commission":      order.PlatformCommission,
		"owner_amount":             order.OwnerAmount,
		"service_type":             order.ServiceType,
	})
}

func BuildExecutionSnapshot(order *model.Order) model.JSON {
	return mustArtifactJSON(map[string]interface{}{
		"status":                 order.Status,
		"provider_user_id":       order.ProviderUserID,
		"drone_owner_user_id":    order.DroneOwnerUserID,
		"executor_pilot_user_id": order.ExecutorPilotUserID,
		"dispatch_task_id":       order.DispatchTaskID,
		"needs_dispatch":         order.NeedsDispatch,
		"execution_mode":         order.ExecutionMode,
		"provider_confirmed_at":  order.ProviderConfirmedAt,
		"provider_rejected_at":   order.ProviderRejectedAt,
		"paid_at":                order.PaidAt,
		"completed_at":           order.CompletedAt,
		"cancel_reason":          order.CancelReason,
		"cancel_by":              order.CancelBy,
	})
}

func BuildDemandSnapshot(demand *model.Demand) model.JSON {
	if demand == nil {
		return mustArtifactJSON(map[string]interface{}{})
	}
	return mustArtifactJSON(map[string]interface{}{
		"demand_id":                    demand.ID,
		"demand_no":                    demand.DemandNo,
		"title":                        demand.Title,
		"service_type":                 demand.ServiceType,
		"cargo_scene":                  demand.CargoScene,
		"description":                  demand.Description,
		"departure_address_snapshot":   demand.DepartureAddressSnapshot,
		"destination_address_snapshot": demand.DestinationAddressSnapshot,
		"service_address_snapshot":     demand.ServiceAddressSnapshot,
		"cargo_weight_kg":              demand.CargoWeightKG,
		"cargo_volume_m3":              demand.CargoVolumeM3,
		"cargo_type":                   demand.CargoType,
		"cargo_special_requirements":   demand.CargoSpecialRequirements,
		"estimated_trip_count":         demand.EstimatedTripCount,
		"budget_min":                   demand.BudgetMin,
		"budget_max":                   demand.BudgetMax,
	})
}

func BuildSupplySnapshot(supply *model.OwnerSupply) model.JSON {
	if supply == nil {
		return mustArtifactJSON(map[string]interface{}{})
	}
	return mustArtifactJSON(map[string]interface{}{
		"supply_id":             supply.ID,
		"supply_no":             supply.SupplyNo,
		"owner_user_id":         supply.OwnerUserID,
		"drone_id":              supply.DroneID,
		"title":                 supply.Title,
		"description":           supply.Description,
		"service_types":         supply.ServiceTypes,
		"cargo_scenes":          supply.CargoScenes,
		"service_area_snapshot": supply.ServiceAreaSnapshot,
		"mtow_kg":               supply.MTOWKG,
		"max_payload_kg":        supply.MaxPayloadKG,
		"max_range_km":          supply.MaxRangeKM,
		"base_price_amount":     supply.BasePriceAmount,
		"pricing_unit":          supply.PricingUnit,
		"pricing_rule":          supply.PricingRule,
		"accepts_direct_order":  supply.AcceptsDirectOrder,
		"status":                supply.Status,
	})
}

func GenerateRefundNo() string {
	return fmt.Sprintf("RF%d", time.Now().UnixNano())
}

func mustArtifactJSON(v interface{}) model.JSON {
	data, _ := json.Marshal(v)
	return model.JSON(data)
}
