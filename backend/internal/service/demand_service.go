package service

import (
	"errors"
	"time"

	"gorm.io/gorm"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type DemandService struct {
	demandRepo *repository.DemandRepo
	clientRepo *repository.ClientRepo
}

func NewDemandService(demandRepo *repository.DemandRepo, clientRepo *repository.ClientRepo) *DemandService {
	return &DemandService{
		demandRepo: demandRepo,
		clientRepo: clientRepo,
	}
}

// Rental Offers
func (s *DemandService) CreateOffer(offer *model.RentalOffer) error {
	// 如果没有设置可用时间，设置默认值
	if offer.AvailableFrom.IsZero() {
		offer.AvailableFrom = time.Now()
	}
	if offer.AvailableTo.IsZero() {
		// 默认可用1年
		offer.AvailableTo = time.Now().AddDate(1, 0, 0)
	}

	db := s.demandRepo.DB()
	if db == nil {
		if err := s.validateOfferForMarketplace(offer, nil); err != nil {
			return err
		}
		return s.demandRepo.CreateOffer(offer)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		droneRepo := repository.NewDroneRepo(tx)
		drone, err := droneRepo.GetByID(offer.DroneID)
		if err != nil {
			return err
		}
		if err := s.validateOfferForMarketplace(offer, drone); err != nil {
			return err
		}
		demandRepo := repository.NewDemandRepo(tx)
		if err := demandRepo.CreateOffer(offer); err != nil {
			return err
		}
		return s.syncOwnerSupply(tx, offer)
	})
}

func (s *DemandService) GetOffer(id int64) (*model.RentalOffer, error) {
	return s.demandRepo.GetOfferByID(id)
}

func (s *DemandService) UpdateOffer(offer *model.RentalOffer) error {
	db := s.demandRepo.DB()
	if db == nil {
		if err := s.validateOfferForMarketplace(offer, nil); err != nil {
			return err
		}
		return s.demandRepo.UpdateOffer(offer)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		droneRepo := repository.NewDroneRepo(tx)
		drone, err := droneRepo.GetByID(offer.DroneID)
		if err != nil {
			return err
		}
		if err := s.validateOfferForMarketplace(offer, drone); err != nil {
			return err
		}
		demandRepo := repository.NewDemandRepo(tx)
		if err := demandRepo.UpdateOffer(offer); err != nil {
			return err
		}
		return s.syncOwnerSupply(tx, offer)
	})
}

func (s *DemandService) DeleteOffer(id int64) error {
	db := s.demandRepo.DB()
	if db == nil {
		return s.demandRepo.DeleteOffer(id)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		demandRepo := repository.NewDemandRepo(tx)
		if _, err := demandRepo.GetOfferByID(id); err != nil {
			return err
		}
		if err := demandRepo.DeleteOffer(id); err != nil {
			return err
		}
		return repository.NewOwnerDomainRepo(tx).CloseSupplyBySupplyNo(repository.LegacySupplyNo(id))
	})
}

func (s *DemandService) ListOffers(page, pageSize int, filters map[string]interface{}) ([]model.RentalOffer, int64, error) {
	return s.demandRepo.ListMarketplaceOffers(page, pageSize, filters)
}

func (s *DemandService) ListMyOffers(ownerID int64, page, pageSize int) ([]model.RentalOffer, int64, error) {
	return s.demandRepo.ListOffersByOwner(ownerID, page, pageSize)
}

// Rental Demands
func (s *DemandService) CreateDemand(demand *model.RentalDemand) error {
	// 如果没有设置时间，设置默认值
	if demand.StartTime.IsZero() {
		demand.StartTime = time.Now()
	}
	if demand.EndTime.IsZero() {
		// 默认1周后
		demand.EndTime = time.Now().AddDate(0, 0, 7)
	}

	db := s.demandRepo.DB()
	if db == nil {
		return s.demandRepo.CreateDemand(demand)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		demandRepo := repository.NewDemandRepo(tx)
		if err := demandRepo.CreateDemand(demand); err != nil {
			return err
		}
		return s.syncRentalDemand(tx, demand)
	})
}

func (s *DemandService) GetDemand(id int64) (*model.RentalDemand, error) {
	return s.demandRepo.GetDemandByID(id)
}

func (s *DemandService) UpdateDemand(demand *model.RentalDemand) error {
	db := s.demandRepo.DB()
	if db == nil {
		return s.demandRepo.UpdateDemand(demand)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		demandRepo := repository.NewDemandRepo(tx)
		if err := demandRepo.UpdateDemand(demand); err != nil {
			return err
		}
		updated, err := demandRepo.GetDemandByID(demand.ID)
		if err != nil {
			return err
		}
		return s.syncRentalDemand(tx, updated)
	})
}

func (s *DemandService) DeleteDemand(id int64) error {
	db := s.demandRepo.DB()
	if db == nil {
		return s.demandRepo.DeleteDemand(id)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		demandRepo := repository.NewDemandRepo(tx)
		if err := demandRepo.DeleteDemand(id); err != nil {
			return err
		}
		return repository.NewDemandDomainRepo(tx).MarkDemandCancelled(repository.LegacyDemandNo("rental_demand", id))
	})
}

func (s *DemandService) ListDemands(page, pageSize int, filters map[string]interface{}) ([]model.RentalDemand, int64, error) {
	return s.demandRepo.ListDemands(page, pageSize, filters)
}

func (s *DemandService) ListMyDemands(renterID int64, page, pageSize int) ([]model.RentalDemand, int64, error) {
	return s.demandRepo.ListDemandsByRenter(renterID, page, pageSize)
}

// Cargo Demands
func (s *DemandService) CreateCargo(cargo *model.CargoDemand) error {
	// 如果没有设置取货时间，设置默认值
	if cargo.PickupTime.IsZero() {
		cargo.PickupTime = time.Now()
	}

	db := s.demandRepo.DB()
	if db == nil {
		return s.demandRepo.CreateCargo(cargo)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		demandRepo := repository.NewDemandRepo(tx)
		if err := demandRepo.CreateCargo(cargo); err != nil {
			return err
		}
		return s.syncCargoDemand(tx, cargo)
	})
}

func (s *DemandService) GetCargo(id int64) (*model.CargoDemand, error) {
	return s.demandRepo.GetCargoByID(id)
}

func (s *DemandService) UpdateCargo(cargo *model.CargoDemand) error {
	db := s.demandRepo.DB()
	if db == nil {
		return s.demandRepo.UpdateCargo(cargo)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		demandRepo := repository.NewDemandRepo(tx)
		if err := demandRepo.UpdateCargo(cargo); err != nil {
			return err
		}
		updated, err := demandRepo.GetCargoByID(cargo.ID)
		if err != nil {
			return err
		}
		return s.syncCargoDemand(tx, updated)
	})
}

func (s *DemandService) DeleteCargo(id int64) error {
	db := s.demandRepo.DB()
	if db == nil {
		return s.demandRepo.DeleteCargo(id)
	}

	return db.Transaction(func(tx *gorm.DB) error {
		demandRepo := repository.NewDemandRepo(tx)
		if err := demandRepo.DeleteCargo(id); err != nil {
			return err
		}
		return repository.NewDemandDomainRepo(tx).MarkDemandCancelled(repository.LegacyDemandNo("cargo_demand", id))
	})
}

func (s *DemandService) ListCargos(page, pageSize int, filters map[string]interface{}) ([]model.CargoDemand, int64, error) {
	return s.demandRepo.ListCargos(page, pageSize, filters)
}

func (s *DemandService) ListMyCargos(publisherID int64, page, pageSize int) ([]model.CargoDemand, int64, error) {
	return s.demandRepo.ListCargosByPublisher(publisherID, page, pageSize)
}

func (s *DemandService) syncOwnerSupply(tx *gorm.DB, offer *model.RentalOffer) error {
	if tx == nil || offer == nil {
		return nil
	}

	droneRepo := repository.NewDroneRepo(tx)
	ownerDomainRepo := repository.NewOwnerDomainRepo(tx)

	var drone *model.Drone
	if offer.DroneID > 0 {
		existingDrone, err := droneRepo.GetByID(offer.DroneID)
		if err != nil {
			return err
		}
		drone = existingDrone
	}

	supply := repository.BuildOwnerSupplyFromLegacyOffer(offer, drone)
	return ownerDomainRepo.UpsertSupply(supply)
}

func (s *DemandService) validateOfferForMarketplace(offer *model.RentalOffer, drone *model.Drone) error {
	if offer == nil {
		return errors.New("供给参数不能为空")
	}
	if offer.Status != "active" {
		return nil
	}

	if drone == nil && offer.DroneID > 0 && s.demandRepo != nil {
		if db := s.demandRepo.DB(); db != nil {
			droneRepo := repository.NewDroneRepo(db)
			existingDrone, err := droneRepo.GetByID(offer.DroneID)
			if err != nil {
				return err
			}
			drone = existingDrone
		}
	}

	if drone == nil {
		return errors.New("无人机不存在")
	}
	if !drone.MeetsHeavyLiftThreshold() {
		return errors.New("无人机不满足平台重载准入门槛，无法发布 active 供给")
	}
	if !drone.EligibleForMarketplace() {
		return errors.New("无人机当前未满足主市场准入条件，无法发布 active 供给")
	}
	return nil
}

func (s *DemandService) syncRentalDemand(tx *gorm.DB, demand *model.RentalDemand) error {
	if tx == nil || demand == nil {
		return nil
	}
	v2Demand := repository.BuildDemandFromLegacyRental(demand)
	if v2Demand == nil {
		return nil
	}
	v2Demand.ClientUserID = s.resolveClientUserID(demand.ClientID, demand.RenterID)
	return repository.NewDemandDomainRepo(tx).UpsertDemand(v2Demand)
}

func (s *DemandService) syncCargoDemand(tx *gorm.DB, cargo *model.CargoDemand) error {
	if tx == nil || cargo == nil {
		return nil
	}
	v2Demand := repository.BuildDemandFromLegacyCargo(cargo)
	if v2Demand == nil {
		return nil
	}
	v2Demand.ClientUserID = s.resolveClientUserID(cargo.ClientID, cargo.PublisherID)
	return repository.NewDemandDomainRepo(tx).UpsertDemand(v2Demand)
}

func (s *DemandService) resolveClientUserID(clientID, fallbackUserID int64) int64 {
	if clientID <= 0 || s.clientRepo == nil {
		return fallbackUserID
	}

	client, err := s.clientRepo.GetByID(clientID)
	if err != nil || client == nil || client.UserID == 0 {
		return fallbackUserID
	}

	return client.UserID
}
