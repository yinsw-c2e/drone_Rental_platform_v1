package service

import (
	"fmt"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

const maxAddressesPerUser = 20

type AddressService struct {
	addressRepo *repository.AddressRepo
}

func NewAddressService(addressRepo *repository.AddressRepo) *AddressService {
	return &AddressService{addressRepo: addressRepo}
}

func (s *AddressService) List(userID int64) ([]model.UserAddress, error) {
	return s.addressRepo.FindByUserID(userID)
}

func (s *AddressService) Create(addr *model.UserAddress) error {
	count, err := s.addressRepo.CountByUserID(addr.UserID)
	if err != nil {
		return err
	}
	if count >= maxAddressesPerUser {
		return fmt.Errorf("常用地址数量已达上限(%d个)", maxAddressesPerUser)
	}

	if addr.IsDefault {
		if err := s.addressRepo.ClearDefault(addr.UserID); err != nil {
			return err
		}
	}

	return s.addressRepo.Create(addr)
}

func (s *AddressService) Update(id, userID int64, updates map[string]interface{}) error {
	// Verify ownership
	if _, err := s.addressRepo.FindByID(id, userID); err != nil {
		return fmt.Errorf("地址不存在")
	}
	return s.addressRepo.Update(id, userID, updates)
}

func (s *AddressService) Delete(id, userID int64) error {
	if _, err := s.addressRepo.FindByID(id, userID); err != nil {
		return fmt.Errorf("地址不存在")
	}
	return s.addressRepo.Delete(id, userID)
}

func (s *AddressService) SetDefault(id, userID int64) error {
	if _, err := s.addressRepo.FindByID(id, userID); err != nil {
		return fmt.Errorf("地址不存在")
	}
	return s.addressRepo.SetDefault(id, userID)
}
