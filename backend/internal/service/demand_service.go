package service

import (
	"time"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type DemandService struct {
	demandRepo *repository.DemandRepo
}

func NewDemandService(demandRepo *repository.DemandRepo) *DemandService {
	return &DemandService{demandRepo: demandRepo}
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
	return s.demandRepo.CreateOffer(offer)
}

func (s *DemandService) GetOffer(id int64) (*model.RentalOffer, error) {
	return s.demandRepo.GetOfferByID(id)
}

func (s *DemandService) UpdateOffer(offer *model.RentalOffer) error {
	return s.demandRepo.UpdateOffer(offer)
}

func (s *DemandService) DeleteOffer(id int64) error {
	return s.demandRepo.DeleteOffer(id)
}

func (s *DemandService) ListOffers(page, pageSize int, filters map[string]interface{}) ([]model.RentalOffer, int64, error) {
	return s.demandRepo.ListOffers(page, pageSize, filters)
}

func (s *DemandService) ListMyOffers(ownerID int64, page, pageSize int) ([]model.RentalOffer, int64, error) {
	return s.demandRepo.ListOffersByOwner(ownerID, page, pageSize)
}

// Rental Demands
func (s *DemandService) CreateDemand(demand *model.RentalDemand) error {
	return s.demandRepo.CreateDemand(demand)
}

func (s *DemandService) GetDemand(id int64) (*model.RentalDemand, error) {
	return s.demandRepo.GetDemandByID(id)
}

func (s *DemandService) UpdateDemand(demand *model.RentalDemand) error {
	return s.demandRepo.UpdateDemand(demand)
}

func (s *DemandService) DeleteDemand(id int64) error {
	return s.demandRepo.DeleteDemand(id)
}

func (s *DemandService) ListDemands(page, pageSize int, filters map[string]interface{}) ([]model.RentalDemand, int64, error) {
	return s.demandRepo.ListDemands(page, pageSize, filters)
}

func (s *DemandService) ListMyDemands(renterID int64, page, pageSize int) ([]model.RentalDemand, int64, error) {
	return s.demandRepo.ListDemandsByRenter(renterID, page, pageSize)
}

// Cargo Demands
func (s *DemandService) CreateCargo(cargo *model.CargoDemand) error {
	return s.demandRepo.CreateCargo(cargo)
}

func (s *DemandService) GetCargo(id int64) (*model.CargoDemand, error) {
	return s.demandRepo.GetCargoByID(id)
}

func (s *DemandService) UpdateCargo(cargo *model.CargoDemand) error {
	return s.demandRepo.UpdateCargo(cargo)
}

func (s *DemandService) DeleteCargo(id int64) error {
	return s.demandRepo.DeleteCargo(id)
}

func (s *DemandService) ListCargos(page, pageSize int, filters map[string]interface{}) ([]model.CargoDemand, int64, error) {
	return s.demandRepo.ListCargos(page, pageSize, filters)
}

func (s *DemandService) ListMyCargos(publisherID int64, page, pageSize int) ([]model.CargoDemand, int64, error) {
	return s.demandRepo.ListCargosByPublisher(publisherID, page, pageSize)
}
