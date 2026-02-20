package service

import (
	"errors"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type DroneService struct {
	droneRepo *repository.DroneRepo
}

func NewDroneService(droneRepo *repository.DroneRepo) *DroneService {
	return &DroneService{droneRepo: droneRepo}
}

func (s *DroneService) Create(drone *model.Drone) error {
	return s.droneRepo.Create(drone)
}

func (s *DroneService) GetByID(id int64) (*model.Drone, error) {
	return s.droneRepo.GetByID(id)
}

func (s *DroneService) Update(userID int64, drone *model.Drone) error {
	existing, err := s.droneRepo.GetByID(drone.ID)
	if err != nil {
		return err
	}
	if existing.OwnerID != userID {
		return errors.New("无权修改此无人机")
	}
	return s.droneRepo.Update(drone)
}

func (s *DroneService) Delete(userID, droneID int64) error {
	existing, err := s.droneRepo.GetByID(droneID)
	if err != nil {
		return err
	}
	if existing.OwnerID != userID {
		return errors.New("无权删除此无人机")
	}
	return s.droneRepo.Delete(droneID)
}

func (s *DroneService) ListByOwner(ownerID int64, page, pageSize int) ([]model.Drone, int64, error) {
	return s.droneRepo.ListByOwner(ownerID, page, pageSize)
}

func (s *DroneService) List(page, pageSize int, filters map[string]interface{}) ([]model.Drone, int64, error) {
	return s.droneRepo.List(page, pageSize, filters)
}

func (s *DroneService) FindNearby(lat, lng, radius float64, page, pageSize int) ([]model.Drone, int64, error) {
	if radius <= 0 {
		radius = 50 // default 50km
	}
	return s.droneRepo.FindNearby(lat, lng, radius, page, pageSize)
}

func (s *DroneService) UpdateAvailability(userID, droneID int64, status string) error {
	existing, err := s.droneRepo.GetByID(droneID)
	if err != nil {
		return err
	}
	if existing.OwnerID != userID {
		return errors.New("无权操作此无人机")
	}
	return s.droneRepo.UpdateFields(droneID, map[string]interface{}{"availability_status": status})
}

func (s *DroneService) SubmitCertification(userID, droneID int64, docs model.JSON) error {
	existing, err := s.droneRepo.GetByID(droneID)
	if err != nil {
		return err
	}
	if existing.OwnerID != userID {
		return errors.New("无权操作此无人机")
	}
	return s.droneRepo.UpdateFields(droneID, map[string]interface{}{
		"certification_docs":   docs,
		"certification_status": "pending",
	})
}

func (s *DroneService) ApproveCertification(droneID int64, approved bool) error {
	status := "approved"
	if !approved {
		status = "rejected"
	}
	return s.droneRepo.UpdateFields(droneID, map[string]interface{}{"certification_status": status})
}
