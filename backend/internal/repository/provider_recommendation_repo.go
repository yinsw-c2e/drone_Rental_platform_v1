package repository

import (
	"database/sql"
	"time"

	"wurenji-backend/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ProviderRecommendationRepo struct {
	db *gorm.DB
}

func NewProviderRecommendationRepo(db *gorm.DB) *ProviderRecommendationRepo {
	return &ProviderRecommendationRepo{db: db}
}

func (r *ProviderRecommendationRepo) DB() *gorm.DB {
	return r.db
}

type ProviderRecommendationCandidate struct {
	User                   model.User
	OwnerProfile           model.OwnerProfile
	Drones                 []model.Drone
	Supplies               []model.OwnerSupply
	Rating                 float64
	RatingCount            int
	CompletedOrders30D     int
	AverageResponseSeconds int
	ResponseSampleCount    int
	HasPreviousCooperation bool
	LastActivityAt         time.Time
}

func (r *ProviderRecommendationRepo) ListProviderCandidates(clientUserID int64, recentSince time.Time) ([]ProviderRecommendationCandidate, error) {
	var profiles []model.OwnerProfile
	if err := r.db.
		Preload("User").
		Joins("JOIN users ON users.id = owner_profiles.user_id AND users.deleted_at IS NULL").
		Where("owner_profiles.verification_status = ? AND owner_profiles.status = ? AND users.status = ?", "approved", "active", "active").
		Find(&profiles).Error; err != nil {
		return nil, err
	}

	candidates := make([]ProviderRecommendationCandidate, 0, len(profiles))
	for _, profile := range profiles {
		if profile.User == nil {
			continue
		}
		candidate := ProviderRecommendationCandidate{
			User:           *profile.User,
			OwnerProfile:   profile,
			LastActivityAt: maxTime(profile.UpdatedAt, profile.User.UpdatedAt),
		}
		if err := r.db.Where("owner_id = ?", profile.UserID).Find(&candidate.Drones).Error; err != nil {
			return nil, err
		}
		if err := r.db.
			Where("owner_user_id = ? AND status IN ?", profile.UserID, []string{"active", "published", "online"}).
			Find(&candidate.Supplies).Error; err != nil {
			return nil, err
		}
		candidate.Rating, candidate.RatingCount = r.providerRating(profile.UserID)
		candidate.CompletedOrders30D = r.completedOrders30D(profile.UserID, recentSince)
		candidate.AverageResponseSeconds, candidate.ResponseSampleCount = r.averageResponseSeconds(profile.UserID)
		candidate.HasPreviousCooperation = r.hasPreviousCooperation(clientUserID, profile.UserID)
		for _, drone := range candidate.Drones {
			candidate.LastActivityAt = maxTime(candidate.LastActivityAt, drone.UpdatedAt)
		}
		for _, supply := range candidate.Supplies {
			candidate.LastActivityAt = maxTime(candidate.LastActivityAt, supply.UpdatedAt)
		}
		candidates = append(candidates, candidate)
	}
	return candidates, nil
}

func (r *ProviderRecommendationRepo) LockDemandByID(demandID int64) (*model.Demand, error) {
	var demand model.Demand
	err := r.db.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ?", demandID).
		First(&demand).Error
	if err != nil {
		return nil, err
	}
	return &demand, nil
}

func (r *ProviderRecommendationRepo) ProviderCanReceiveInvitation(providerUserID int64) (bool, error) {
	var count int64
	err := r.db.Model(&model.OwnerProfile{}).
		Joins("JOIN users ON users.id = owner_profiles.user_id AND users.deleted_at IS NULL").
		Where("owner_profiles.user_id = ?", providerUserID).
		Where("owner_profiles.verification_status = ? AND owner_profiles.status = ? AND users.status = ?", "approved", "active", "active").
		Count(&count).Error
	return count > 0, err
}

func (r *ProviderRecommendationRepo) GetDemandProviderInvitation(demandID, providerUserID int64) (*model.DemandProviderInvitation, error) {
	var invitation model.DemandProviderInvitation
	err := r.db.
		Where("demand_id = ? AND provider_user_id = ?", demandID, providerUserID).
		First(&invitation).Error
	if err != nil {
		return nil, err
	}
	return &invitation, nil
}

func (r *ProviderRecommendationRepo) GetDemandProviderInvitationByID(id int64) (*model.DemandProviderInvitation, error) {
	var invitation model.DemandProviderInvitation
	err := r.db.Where("id = ?", id).First(&invitation).Error
	if err != nil {
		return nil, err
	}
	return &invitation, nil
}

func (r *ProviderRecommendationRepo) ListDemandProviderInvitations(demandID int64) (map[int64]model.DemandProviderInvitation, error) {
	result := make(map[int64]model.DemandProviderInvitation)
	if demandID <= 0 {
		return result, nil
	}
	var invitations []model.DemandProviderInvitation
	if err := r.db.Where("demand_id = ?", demandID).Find(&invitations).Error; err != nil {
		return nil, err
	}
	for _, invitation := range invitations {
		result[invitation.ProviderUserID] = invitation
	}
	return result, nil
}

func (r *ProviderRecommendationRepo) CreateDemandProviderInvitation(invitation *model.DemandProviderInvitation) error {
	if invitation == nil {
		return nil
	}
	return r.db.Create(invitation).Error
}

func (r *ProviderRecommendationRepo) UpdateDemandProviderInvitationFields(id int64, fields map[string]interface{}) error {
	if id == 0 || len(fields) == 0 {
		return nil
	}
	return r.db.Model(&model.DemandProviderInvitation{}).Where("id = ?", id).Updates(fields).Error
}

func (r *ProviderRecommendationRepo) MarkInvitationQuoted(demandID, providerUserID int64) error {
	if demandID <= 0 || providerUserID <= 0 {
		return nil
	}
	return r.db.Model(&model.DemandProviderInvitation{}).
		Where("demand_id = ? AND provider_user_id = ?", demandID, providerUserID).
		Where("status <> ?", model.DemandProviderInvitationStatusSelected).
		Updates(map[string]interface{}{
			"status":     model.DemandProviderInvitationStatusQuoted,
			"updated_at": time.Now(),
		}).Error
}

func (r *ProviderRecommendationRepo) providerRating(providerUserID int64) (float64, int) {
	var row struct {
		Rating sql.NullFloat64
		Count  int64
	}
	if err := r.db.Model(&model.Review{}).
		Select("AVG(rating) AS rating, COUNT(*) AS count").
		Where("reviewee_id = ?", providerUserID).
		Where("(target_type = '' OR target_type IN ?)", []string{"user", "owner", "pilot", "provider"}).
		Scan(&row).Error; err != nil {
		return 0, 0
	}
	if !row.Rating.Valid || row.Count == 0 {
		return 0, 0
	}
	return row.Rating.Float64, int(row.Count)
}

func (r *ProviderRecommendationRepo) completedOrders30D(providerUserID int64, since time.Time) int {
	var count int64
	if err := r.db.Model(&model.Order{}).
		Where("(provider_user_id = ? OR owner_id = ? OR drone_owner_user_id = ?)", providerUserID, providerUserID, providerUserID).
		Where("status = ? AND completed_at >= ?", "completed", since).
		Count(&count).Error; err != nil {
		return 0
	}
	return int(count)
}

func (r *ProviderRecommendationRepo) averageResponseSeconds(providerUserID int64) (int, int) {
	var orders []model.Order
	if err := r.db.
		Where("(provider_user_id = ? OR owner_id = ? OR drone_owner_user_id = ?)", providerUserID, providerUserID, providerUserID).
		Where("provider_confirmed_at IS NOT NULL").
		Find(&orders).Error; err != nil {
		return 0, 0
	}
	totalSeconds := 0.0
	samples := 0
	for _, order := range orders {
		if order.ProviderConfirmedAt == nil || order.CreatedAt.IsZero() {
			continue
		}
		seconds := order.ProviderConfirmedAt.Sub(order.CreatedAt).Seconds()
		if seconds <= 0 {
			continue
		}
		totalSeconds += seconds
		samples++
	}

	var quotes []model.DemandQuote
	if err := r.db.Preload("Demand").Where("owner_user_id = ?", providerUserID).Find(&quotes).Error; err == nil {
		for _, quote := range quotes {
			if quote.Demand == nil || quote.Demand.CreatedAt.IsZero() || quote.CreatedAt.IsZero() {
				continue
			}
			seconds := quote.CreatedAt.Sub(quote.Demand.CreatedAt).Seconds()
			if seconds <= 0 {
				continue
			}
			totalSeconds += seconds
			samples++
		}
	}
	if samples == 0 {
		return 0, 0
	}
	return int(totalSeconds / float64(samples)), samples
}

func (r *ProviderRecommendationRepo) hasPreviousCooperation(clientUserID int64, providerUserID int64) bool {
	if clientUserID <= 0 {
		return false
	}
	var count int64
	if err := r.db.Model(&model.Order{}).
		Where("client_user_id = ?", clientUserID).
		Where("(provider_user_id = ? OR owner_id = ? OR drone_owner_user_id = ?)", providerUserID, providerUserID, providerUserID).
		Count(&count).Error; err != nil {
		return false
	}
	return count > 0
}

func maxTime(a, b time.Time) time.Time {
	if b.After(a) {
		return b
	}
	return a
}
