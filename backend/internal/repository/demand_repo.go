package repository

import (
	"wurenji-backend/internal/model"

	"gorm.io/gorm"
)

type DemandRepo struct {
	db *gorm.DB
}

func NewDemandRepo(db *gorm.DB) *DemandRepo {
	return &DemandRepo{db: db}
}

// Rental Offer
func (r *DemandRepo) CreateOffer(offer *model.RentalOffer) error {
	return r.db.Create(offer).Error
}

func (r *DemandRepo) GetOfferByID(id int64) (*model.RentalOffer, error) {
	var offer model.RentalOffer
	err := r.db.Preload("Drone").Preload("Owner").Where("id = ?", id).First(&offer).Error
	return &offer, err
}

func (r *DemandRepo) UpdateOffer(offer *model.RentalOffer) error {
	return r.db.Save(offer).Error
}

func (r *DemandRepo) DeleteOffer(id int64) error {
	return r.db.Delete(&model.RentalOffer{}, id).Error
}

func (r *DemandRepo) ListOffers(page, pageSize int, filters map[string]interface{}) ([]model.RentalOffer, int64, error) {
	var offers []model.RentalOffer
	var total int64

	query := r.db.Model(&model.RentalOffer{}).Preload("Drone").Preload("Owner")
	for k, v := range filters {
		query = query.Where(k+" = ?", v)
	}

	query.Count(&total)
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&offers).Error
	return offers, total, err
}

func (r *DemandRepo) ListOffersByOwner(ownerID int64, page, pageSize int) ([]model.RentalOffer, int64, error) {
	return r.ListOffers(page, pageSize, map[string]interface{}{"owner_id": ownerID})
}

// Rental Demand
func (r *DemandRepo) CreateDemand(demand *model.RentalDemand) error {
	return r.db.Create(demand).Error
}

func (r *DemandRepo) GetDemandByID(id int64) (*model.RentalDemand, error) {
	var demand model.RentalDemand
	err := r.db.Preload("Renter").Where("id = ?", id).First(&demand).Error
	return &demand, err
}

func (r *DemandRepo) UpdateDemand(demand *model.RentalDemand) error {
	return r.db.Save(demand).Error
}

func (r *DemandRepo) DeleteDemand(id int64) error {
	return r.db.Delete(&model.RentalDemand{}, id).Error
}

func (r *DemandRepo) ListDemands(page, pageSize int, filters map[string]interface{}) ([]model.RentalDemand, int64, error) {
	var demands []model.RentalDemand
	var total int64

	query := r.db.Model(&model.RentalDemand{}).Preload("Renter")
	for k, v := range filters {
		query = query.Where(k+" = ?", v)
	}

	query.Count(&total)
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&demands).Error
	return demands, total, err
}

func (r *DemandRepo) ListDemandsByRenter(renterID int64, page, pageSize int) ([]model.RentalDemand, int64, error) {
	return r.ListDemands(page, pageSize, map[string]interface{}{"renter_id": renterID})
}

func (r *DemandRepo) ListActiveDemands() ([]model.RentalDemand, error) {
	var demands []model.RentalDemand
	err := r.db.Where("status = ?", "active").Find(&demands).Error
	return demands, err
}

// Cargo Demand
func (r *DemandRepo) CreateCargo(cargo *model.CargoDemand) error {
	return r.db.Create(cargo).Error
}

func (r *DemandRepo) GetCargoByID(id int64) (*model.CargoDemand, error) {
	var cargo model.CargoDemand
	err := r.db.Preload("Publisher").Where("id = ?", id).First(&cargo).Error
	return &cargo, err
}

func (r *DemandRepo) UpdateCargo(cargo *model.CargoDemand) error {
	return r.db.Save(cargo).Error
}

func (r *DemandRepo) DeleteCargo(id int64) error {
	return r.db.Delete(&model.CargoDemand{}, id).Error
}

func (r *DemandRepo) ListCargos(page, pageSize int, filters map[string]interface{}) ([]model.CargoDemand, int64, error) {
	var cargos []model.CargoDemand
	var total int64

	query := r.db.Model(&model.CargoDemand{}).Preload("Publisher")
	for k, v := range filters {
		query = query.Where(k+" = ?", v)
	}

	query.Count(&total)
	err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&cargos).Error
	return cargos, total, err
}

func (r *DemandRepo) ListCargosByPublisher(publisherID int64, page, pageSize int) ([]model.CargoDemand, int64, error) {
	return r.ListCargos(page, pageSize, map[string]interface{}{"publisher_id": publisherID})
}

func (r *DemandRepo) ListActiveCargos() ([]model.CargoDemand, error) {
	var cargos []model.CargoDemand
	err := r.db.Where("status = ?", "active").Find(&cargos).Error
	return cargos, err
}
