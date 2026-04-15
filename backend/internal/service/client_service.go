package service

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

type ClientService struct {
	clientRepo       *repository.ClientRepo
	userRepo         *repository.UserRepo
	roleProfileRepo  *repository.RoleProfileRepo
	ownerDomainRepo  *repository.OwnerDomainRepo
	demandDomainRepo *repository.DemandDomainRepo
	orderService     *OrderService
	matchingService  *MatchingService
	eventService     *EventService
	contractService  *ContractService
}

func NewClientService(
	clientRepo *repository.ClientRepo,
	userRepo *repository.UserRepo,
	roleProfileRepo *repository.RoleProfileRepo,
	ownerDomainRepo *repository.OwnerDomainRepo,
	demandDomainRepo *repository.DemandDomainRepo,
	orderService *OrderService,
) *ClientService {
	return &ClientService{
		clientRepo:       clientRepo,
		userRepo:         userRepo,
		roleProfileRepo:  roleProfileRepo,
		ownerDomainRepo:  ownerDomainRepo,
		demandDomainRepo: demandDomainRepo,
		orderService:     orderService,
	}
}

type ClientProfileUpdateInput struct {
	ClientType             *string   `json:"client_type"`
	CompanyName            *string   `json:"company_name"`
	BusinessLicenseNo      *string   `json:"business_license_no"`
	BusinessLicenseDoc     *string   `json:"business_license_doc"`
	LegalRepresentative    *string   `json:"legal_representative"`
	ContactPerson          *string   `json:"contact_person"`
	ContactPhone           *string   `json:"contact_phone"`
	ContactEmail           *string   `json:"contact_email"`
	PreferredCargoTypes    *[]string `json:"preferred_cargo_types"`
	DefaultPickupAddress   *string   `json:"default_pickup_address"`
	DefaultDeliveryAddress *string   `json:"default_delivery_address"`
	DefaultContactName     *string   `json:"default_contact_name"`
	DefaultContactPhone    *string   `json:"default_contact_phone"`
	PreferredCity          *string   `json:"preferred_city"`
	Remark                 *string   `json:"remark"`
}

type ClientProfileView struct {
	ID                         int64                  `json:"id"`
	UserID                     int64                  `json:"user_id"`
	ClientType                 string                 `json:"client_type"`
	CompanyName                string                 `json:"company_name,omitempty"`
	BusinessLicenseNo          string                 `json:"business_license_no,omitempty"`
	BusinessLicenseDoc         string                 `json:"business_license_doc,omitempty"`
	LegalRepresentative        string                 `json:"legal_representative,omitempty"`
	ContactPerson              string                 `json:"contact_person,omitempty"`
	ContactPhone               string                 `json:"contact_phone,omitempty"`
	ContactEmail               string                 `json:"contact_email,omitempty"`
	CreditScore                int                    `json:"credit_score"`
	DefaultContactName         string                 `json:"default_contact_name,omitempty"`
	DefaultContactPhone        string                 `json:"default_contact_phone,omitempty"`
	PreferredCargoTypes        []string               `json:"preferred_cargo_types,omitempty"`
	DefaultPickupAddress       string                 `json:"default_pickup_address,omitempty"`
	DefaultDeliveryAddress     string                 `json:"default_delivery_address,omitempty"`
	PreferredCity              string                 `json:"preferred_city,omitempty"`
	Remark                     string                 `json:"remark,omitempty"`
	TotalOrders                int                    `json:"total_orders"`
	CompletedOrders            int                    `json:"completed_orders"`
	CancelledOrders            int                    `json:"cancelled_orders"`
	TotalSpending              int64                  `json:"total_spending"`
	AverageRating              float64                `json:"average_rating"`
	Status                     string                 `json:"status"`
	VerificationStatus         string                 `json:"verification_status"`
	ClientVerificationStatus   string                 `json:"client_verification_status,omitempty"`
	IdentityVerificationStatus string                 `json:"identity_verification_status"`
	VerificationNote           string                 `json:"verification_note,omitempty"`
	EnterpriseVerified         string                 `json:"enterprise_verified"`
	CreditCheckStatus          string                 `json:"credit_check_status"`
	PlatformCreditScore        int                    `json:"platform_credit_score"`
	Eligibility                *ClientEligibilityView `json:"eligibility,omitempty"`
	CreatedAt                  time.Time              `json:"created_at"`
	UpdatedAt                  time.Time              `json:"updated_at"`
	VerifiedAt                 *time.Time             `json:"verified_at,omitempty"`
}

const minClientPlatformCreditScore = 300

const (
	clientEligibilityActionPublishDemand     = "publish_demand"
	clientEligibilityActionCreateDirectOrder = "create_direct_order"
	clientEligibilityActionSelectProvider    = "select_provider"
)

type ClientEligibilityBlocker struct {
	Code            string `json:"code"`
	Message         string `json:"message"`
	SuggestedAction string `json:"suggested_action,omitempty"`
}

type ClientEligibilityView struct {
	Eligible                  bool                       `json:"eligible"`
	CanPublishDemand          bool                       `json:"can_publish_demand"`
	CanCreateDirectOrder      bool                       `json:"can_create_direct_order"`
	AccountActive             bool                       `json:"account_active"`
	IdentityVerified          bool                       `json:"identity_verified"`
	CreditQualified           bool                       `json:"credit_qualified"`
	EnterpriseUpgradeOptional bool                       `json:"enterprise_upgrade_optional"`
	Summary                   string                     `json:"summary"`
	Blockers                  []ClientEligibilityBlocker `json:"blockers,omitempty"`
}

type SupplyMarketQuery struct {
	Region             string
	CargoScene         string
	ServiceType        string
	MinPayloadKG       float64
	AcceptsDirectOrder *bool
}

type DemandStats struct {
	QuoteCount          int64 `json:"quote_count"`
	CandidatePilotCount int64 `json:"candidate_pilot_count"`
}

func (s *ClientService) SetMatchingService(matchingService *MatchingService) {
	s.matchingService = matchingService
}

func (s *ClientService) SetEventService(eventService *EventService) {
	s.eventService = eventService
}

func (s *ClientService) SetContractService(contractService *ContractService) {
	s.contractService = contractService
}

func (s *ClientService) AdminListDemands(page, pageSize int, filters map[string]interface{}) ([]model.Demand, int64, error) {
	if s.demandDomainRepo == nil {
		return nil, 0, errors.New("需求域仓储未初始化")
	}
	return s.demandDomainRepo.AdminListDemands(page, pageSize, filters)
}

func (s *ClientService) ensureDefaultClient(userID int64) (*model.Client, error) {
	existing, err := s.clientRepo.GetByUserID(userID)
	if err == nil && existing != nil {
		if err := s.ensureClientRoleProfile(existing.UserID); err != nil {
			return nil, err
		}
		return existing, nil
	}

	if _, err := s.userRepo.GetByID(userID); err != nil {
		return nil, errors.New("用户不存在")
	}

	client := &model.Client{
		UserID:              userID,
		ClientType:          "individual",
		PlatformCreditScore: 600,
		Status:              "active",
	}
	if err := s.clientRepo.Create(client); err != nil {
		return nil, err
	}

	if err := s.ensureClientRoleProfile(userID); err != nil {
		return nil, err
	}
	return client, nil
}

func (s *ClientService) ensureClientRoleProfile(userID int64) error {
	if s.roleProfileRepo == nil || userID == 0 {
		return nil
	}
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return err
	}

	defaultContactName := user.Nickname
	if defaultContactName == "" {
		defaultContactName = user.Phone
	}

	return s.roleProfileRepo.EnsureClientProfile(&model.ClientProfile{
		UserID:              userID,
		Status:              "active",
		DefaultContactName:  defaultContactName,
		DefaultContactPhone: user.Phone,
	})
}

// ==================== 客户注册与档案管理 ====================

// RegisterIndividual 注册个人客户
func (s *ClientService) RegisterIndividual(userID int64) (*model.Client, error) {
	return s.ensureDefaultClient(userID)
}

// RegisterEnterprise 注册企业客户
func (s *ClientService) RegisterEnterprise(userID int64, companyName, businessLicenseNo, businessLicenseDoc, legalRep, contactPerson, contactPhone, contactEmail string) (*model.Client, error) {
	// 检查是否已存在
	existing, _ := s.clientRepo.GetByUserID(userID)
	if existing != nil {
		if existing.ClientType == "enterprise" {
			return nil, errors.New("企业档案已存在")
		}

		updates := map[string]interface{}{
			"client_type":          "enterprise",
			"company_name":         companyName,
			"business_license_no":  businessLicenseNo,
			"business_license_doc": businessLicenseDoc,
			"legal_representative": legalRep,
			"contact_person":       contactPerson,
			"contact_phone":        contactPhone,
			"contact_email":        contactEmail,
			"status":               "active",
		}
		if err := s.clientRepo.UpdateFields(existing.ID, updates); err != nil {
			return nil, err
		}
		if err := s.ensureClientRoleProfile(userID); err != nil {
			return nil, err
		}
		return s.clientRepo.GetByID(existing.ID)
	}

	// 检查营业执照是否已被注册
	existingLicense, _ := s.clientRepo.GetByBusinessLicenseNo(businessLicenseNo)
	if existingLicense != nil {
		return nil, errors.New("该营业执照已被注册")
	}

	client := &model.Client{
		UserID:              userID,
		ClientType:          "enterprise",
		CompanyName:         companyName,
		BusinessLicenseNo:   businessLicenseNo,
		BusinessLicenseDoc:  businessLicenseDoc,
		LegalRepresentative: legalRep,
		ContactPerson:       contactPerson,
		ContactPhone:        contactPhone,
		ContactEmail:        contactEmail,
		PlatformCreditScore: 600,
		Status:              "active",
	}

	if err := s.clientRepo.Create(client); err != nil {
		return nil, err
	}
	if err := s.ensureClientRoleProfile(userID); err != nil {
		return nil, err
	}

	return client, nil
}

// GetProfile 获取客户档案
func (s *ClientService) GetProfile(userID int64) (*model.Client, error) {
	return s.ensureDefaultClient(userID)
}

func (s *ClientService) GetCurrentProfile(userID int64) (*ClientProfileView, error) {
	client, err := s.ensureDefaultClient(userID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureClientRoleProfile(userID); err != nil {
		return nil, err
	}
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, errors.New("用户不存在")
	}

	roleProfile, err := s.roleProfileRepo.GetClientProfileByUserID(userID)
	if err != nil {
		return nil, err
	}

	return buildClientProfileView(client, roleProfile, user), nil
}

func (s *ClientService) GetCurrentEligibility(userID int64) (*ClientEligibilityView, error) {
	client, err := s.ensureDefaultClient(userID)
	if err != nil {
		return nil, err
	}
	user, err := s.userRepo.GetByID(userID)
	if err != nil {
		return nil, errors.New("用户不存在")
	}
	return buildClientEligibilityView(client, user), nil
}

// GetByID 根据ID获取客户
func (s *ClientService) GetByID(id int64) (*model.Client, error) {
	return s.clientRepo.GetByID(id)
}

// UpdateProfile 更新客户档案
func (s *ClientService) UpdateProfile(clientID int64, updates map[string]interface{}) error {
	// 不允许更新敏感字段
	delete(updates, "id")
	delete(updates, "user_id")
	delete(updates, "credit_score")
	delete(updates, "platform_credit_score")
	delete(updates, "verification_status")
	delete(updates, "enterprise_verified")

	return s.clientRepo.UpdateFields(clientID, updates)
}

func (s *ClientService) UpdateCurrentProfile(userID int64, input *ClientProfileUpdateInput) (*ClientProfileView, error) {
	client, err := s.ensureDefaultClient(userID)
	if err != nil {
		return nil, err
	}
	if err := s.ensureClientRoleProfile(userID); err != nil {
		return nil, err
	}

	db := s.clientRepo.DB()
	if db == nil {
		return nil, errors.New("客户域数据库未初始化")
	}

	var updatedView *ClientProfileView
	err = db.Transaction(func(tx *gorm.DB) error {
		clientRepo := repository.NewClientRepo(tx)
		roleRepo := repository.NewRoleProfileRepo(tx)

		clientUpdates := buildClientProfileUpdates(input)
		if len(clientUpdates) > 0 {
			if err := clientRepo.UpdateFields(client.ID, clientUpdates); err != nil {
				return err
			}
		}

		if err := roleRepo.EnsureClientProfile(&model.ClientProfile{UserID: userID, Status: "active"}); err != nil {
			return err
		}

		roleUpdates := buildClientRoleProfileUpdates(input)
		if len(roleUpdates) > 0 {
			if err := tx.Model(&model.ClientProfile{}).Where("user_id = ?", userID).Updates(roleUpdates).Error; err != nil {
				return err
			}
		}

		updatedClient, err := clientRepo.GetByUserID(userID)
		if err != nil {
			return err
		}
		user, err := s.userRepo.GetByID(userID)
		if err != nil {
			return errors.New("用户不存在")
		}
		roleProfile, err := roleRepo.GetClientProfileByUserID(userID)
		if err != nil {
			return err
		}
		updatedView = buildClientProfileView(updatedClient, roleProfile, user)
		return nil
	})
	if err != nil {
		return nil, err
	}

	return updatedView, nil
}

func (s *ClientService) ListMarketplaceSupplies(query SupplyMarketQuery, page, pageSize int) ([]model.OwnerSupply, int64, error) {
	if s.ownerDomainRepo == nil {
		return nil, 0, errors.New("供给域仓储未初始化")
	}
	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if query.ServiceType == "" {
		query.ServiceType = defaultDemandServiceType
	}
	return s.ownerDomainRepo.ListMarketplaceSupplies(
		query.Region,
		query.CargoScene,
		query.ServiceType,
		query.MinPayloadKG,
		query.AcceptsDirectOrder,
		page,
		pageSize,
	)
}

func (s *ClientService) GetMarketplaceSupplyDetail(supplyID int64) (*model.OwnerSupply, error) {
	if s.ownerDomainRepo == nil {
		return nil, errors.New("供给域仓储未初始化")
	}
	return s.ownerDomainRepo.GetMarketplaceSupplyByID(supplyID)
}

func (s *ClientService) GetDemandStats(demandIDs []int64) (map[int64]DemandStats, error) {
	result := make(map[int64]DemandStats)
	if s.demandDomainRepo == nil || len(demandIDs) == 0 {
		return result, nil
	}

	quoteCounts, err := s.demandDomainRepo.CountQuotesByDemandIDs(demandIDs)
	if err != nil {
		return nil, err
	}
	candidateCounts, err := s.demandDomainRepo.CountActiveCandidatesByDemandIDs(demandIDs)
	if err != nil {
		return nil, err
	}

	for _, demandID := range demandIDs {
		result[demandID] = DemandStats{
			QuoteCount:          quoteCounts[demandID],
			CandidatePilotCount: candidateCounts[demandID],
		}
	}
	return result, nil
}

// List 获取客户列表
func (s *ClientService) List(page, pageSize int, clientType, status string) ([]model.Client, int64, error) {
	return s.clientRepo.List(page, pageSize, clientType, status)
}

// ==================== 征信查询 ====================

// RequestCreditCheck 发起征信查询
func (s *ClientService) RequestCreditCheck(clientID int64, provider, checkType string) (*model.ClientCreditCheck, error) {
	client, err := s.clientRepo.GetByID(clientID)
	if err != nil {
		return nil, errors.New("客户不存在")
	}

	// 检查是否频繁查询(24小时内最多3次)
	recentChecks, err := s.clientRepo.GetCreditChecksByClientID(clientID, 10)
	if err == nil {
		count := 0
		for _, check := range recentChecks {
			if time.Since(check.CreatedAt) < 24*time.Hour {
				count++
			}
		}
		if count >= 3 {
			return nil, errors.New("24小时内查询次数已达上限")
		}
	}

	// 创建查询记录
	check := &model.ClientCreditCheck{
		ClientID:      clientID,
		CheckProvider: provider,
		CheckType:     checkType,
		Status:        "pending",
	}

	if err := s.clientRepo.CreateCreditCheck(check); err != nil {
		return nil, err
	}

	// TODO: 实际调用第三方征信API
	// 此处模拟征信查询结果
	check.CreditScore = 650
	check.CreditLevel = s.getCreditLevel(650)
	check.RiskLevel = "low"
	check.Overdue = false
	check.Status = "success"

	// 更新客户征信信息
	now := time.Now()
	s.clientRepo.UpdateFields(client.ID, map[string]interface{}{
		"credit_provider":     provider,
		"credit_score":        check.CreditScore,
		"credit_check_status": "approved",
		"credit_check_time":   &now,
	})

	return check, nil
}

func (s *ClientService) getCreditLevel(score int) string {
	if score >= 700 {
		return "excellent"
	} else if score >= 600 {
		return "good"
	} else if score >= 500 {
		return "fair"
	}
	return "poor"
}

// GetCreditHistory 获取征信查询历史
func (s *ClientService) GetCreditHistory(clientID int64, limit int) ([]model.ClientCreditCheck, error) {
	return s.clientRepo.GetCreditChecksByClientID(clientID, limit)
}

func buildClientProfileView(client *model.Client, roleProfile *model.ClientProfile, user *model.User) *ClientProfileView {
	if client == nil {
		return nil
	}

	identityStatus := resolveClientIdentityVerificationStatus(client, user)
	eligibility := buildClientEligibilityView(client, user)

	view := &ClientProfileView{
		ID:                         client.ID,
		UserID:                     client.UserID,
		ClientType:                 client.ClientType,
		CompanyName:                client.CompanyName,
		BusinessLicenseNo:          client.BusinessLicenseNo,
		BusinessLicenseDoc:         client.BusinessLicenseDoc,
		LegalRepresentative:        client.LegalRepresentative,
		ContactPerson:              client.ContactPerson,
		ContactPhone:               client.ContactPhone,
		ContactEmail:               client.ContactEmail,
		CreditScore:                client.CreditScore,
		PreferredCargoTypes:        decodeClientStringSlice(client.PreferredCargoTypes),
		DefaultPickupAddress:       client.DefaultPickupAddress,
		DefaultDeliveryAddress:     client.DefaultDeliveryAddress,
		TotalOrders:                client.TotalOrders,
		CompletedOrders:            client.CompletedOrders,
		CancelledOrders:            client.CancelledOrders,
		TotalSpending:              client.TotalSpending,
		AverageRating:              client.AverageRating,
		Status:                     client.Status,
		VerificationStatus:         identityStatus,
		ClientVerificationStatus:   client.VerificationStatus,
		IdentityVerificationStatus: identityStatus,
		VerificationNote:           client.VerificationNote,
		EnterpriseVerified:         client.EnterpriseVerified,
		CreditCheckStatus:          client.CreditCheckStatus,
		PlatformCreditScore:        client.PlatformCreditScore,
		Eligibility:                eligibility,
		CreatedAt:                  client.CreatedAt,
		UpdatedAt:                  client.UpdatedAt,
		VerifiedAt:                 client.VerifiedAt,
	}

	if roleProfile != nil {
		view.DefaultContactName = roleProfile.DefaultContactName
		view.DefaultContactPhone = roleProfile.DefaultContactPhone
		view.PreferredCity = roleProfile.PreferredCity
		view.Remark = roleProfile.Remark
	}

	return view
}

func buildClientProfileUpdates(input *ClientProfileUpdateInput) map[string]interface{} {
	if input == nil {
		return nil
	}
	updates := map[string]interface{}{}
	if input.ClientType != nil {
		updates["client_type"] = *input.ClientType
	}
	if input.CompanyName != nil {
		updates["company_name"] = *input.CompanyName
	}
	if input.BusinessLicenseNo != nil {
		updates["business_license_no"] = *input.BusinessLicenseNo
	}
	if input.BusinessLicenseDoc != nil {
		updates["business_license_doc"] = *input.BusinessLicenseDoc
	}
	if input.LegalRepresentative != nil {
		updates["legal_representative"] = *input.LegalRepresentative
	}
	if input.ContactPerson != nil {
		updates["contact_person"] = *input.ContactPerson
	}
	if input.ContactPhone != nil {
		updates["contact_phone"] = *input.ContactPhone
	}
	if input.ContactEmail != nil {
		updates["contact_email"] = *input.ContactEmail
	}
	if input.PreferredCargoTypes != nil {
		if encoded, err := json.Marshal(*input.PreferredCargoTypes); err == nil {
			updates["preferred_cargo_types"] = model.JSON(encoded)
		}
	}
	if input.DefaultPickupAddress != nil {
		updates["default_pickup_address"] = *input.DefaultPickupAddress
	}
	if input.DefaultDeliveryAddress != nil {
		updates["default_delivery_address"] = *input.DefaultDeliveryAddress
	}
	return updates
}

func buildClientRoleProfileUpdates(input *ClientProfileUpdateInput) map[string]interface{} {
	if input == nil {
		return nil
	}
	updates := map[string]interface{}{}
	if input.DefaultContactName != nil {
		updates["default_contact_name"] = *input.DefaultContactName
	}
	if input.DefaultContactPhone != nil {
		updates["default_contact_phone"] = *input.DefaultContactPhone
	}
	if input.PreferredCity != nil {
		updates["preferred_city"] = *input.PreferredCity
	}
	if input.Remark != nil {
		updates["remark"] = *input.Remark
	}
	return updates
}

// GetLatestCreditCheck 获取最新征信结果
func (s *ClientService) GetLatestCreditCheck(clientID int64) (*model.ClientCreditCheck, error) {
	return s.clientRepo.GetLatestCreditCheck(clientID)
}

// ==================== 企业资质管理 ====================

// SubmitEnterpriseCert 提交企业资质证书
func (s *ClientService) SubmitEnterpriseCert(clientID int64, certType, certName, certNo, issuingAuthority string, issueDate, expireDate *time.Time, certImage string) (*model.ClientEnterpriseCert, error) {
	client, err := s.clientRepo.GetByID(clientID)
	if err != nil {
		return nil, errors.New("客户不存在")
	}

	if client.ClientType != "enterprise" {
		return nil, errors.New("仅企业客户可提交企业资质")
	}

	cert := &model.ClientEnterpriseCert{
		ClientID:         clientID,
		CertType:         certType,
		CertName:         certName,
		CertNo:           certNo,
		IssuingAuthority: issuingAuthority,
		IssueDate:        issueDate,
		ExpireDate:       expireDate,
		CertImage:        certImage,
		Status:           "pending",
	}

	if err := s.clientRepo.CreateEnterpriseCert(cert); err != nil {
		return nil, err
	}

	return cert, nil
}

// GetEnterpriseCerts 获取企业资质列表
func (s *ClientService) GetEnterpriseCerts(clientID int64) ([]model.ClientEnterpriseCert, error) {
	return s.clientRepo.GetEnterpriseCertsByClientID(clientID)
}

// ApproveEnterpriseCert 审批通过企业资质
func (s *ClientService) ApproveEnterpriseCert(certID int64, reviewNote string, reviewedBy int64) error {
	return s.clientRepo.UpdateEnterpriseCertStatus(certID, "approved", reviewNote, reviewedBy)
}

// RejectEnterpriseCert 审批拒绝企业资质
func (s *ClientService) RejectEnterpriseCert(certID int64, reviewNote string, reviewedBy int64) error {
	return s.clientRepo.UpdateEnterpriseCertStatus(certID, "rejected", reviewNote, reviewedBy)
}

// CheckHazmatPermit 检查是否有有效的危化品许可
func (s *ClientService) CheckHazmatPermit(clientID int64) (bool, error) {
	return s.clientRepo.CheckHazmatPermit(clientID)
}

// ==================== 货物申报管理 ====================

// CreateCargoDeclaration 创建货物申报
func (s *ClientService) CreateCargoDeclaration(clientID int64, decl *model.CargoDeclaration) (*model.CargoDeclaration, error) {
	client, err := s.clientRepo.GetByID(clientID)
	if err != nil {
		return nil, errors.New("客户不存在")
	}

	// 危险品检查
	if decl.IsHazardous {
		hasPermit, err := s.clientRepo.CheckHazmatPermit(clientID)
		if err != nil || !hasPermit {
			return nil, errors.New("运输危险品需要有效的危化品运输许可证")
		}
	}

	decl.ClientID = clientID
	decl.DeclarationNo = s.clientRepo.GenerateDeclarationNo()
	decl.ComplianceStatus = "pending"

	// 根据货物类型自动设置合规状态
	if !decl.IsHazardous && decl.CargoCategory == "normal" && decl.DeclaredValue < 1000000 {
		// 普通货物且申报价值低于1万元，自动通过
		decl.ComplianceStatus = "approved"
		now := time.Now()
		decl.ComplianceCheckedAt = &now
		decl.ComplianceNote = "系统自动审批通过"
	}

	if err := s.clientRepo.CreateCargoDeclaration(decl); err != nil {
		return nil, err
	}

	_ = client // 暂时不用
	return decl, nil
}

// GetCargoDeclaration 获取货物申报详情
func (s *ClientService) GetCargoDeclaration(id int64) (*model.CargoDeclaration, error) {
	return s.clientRepo.GetCargoDeclarationByID(id)
}

// GetCargoDeclarationByOrderID 根据订单ID获取货物申报
func (s *ClientService) GetCargoDeclarationByOrderID(orderID int64) (*model.CargoDeclaration, error) {
	return s.clientRepo.GetCargoDeclarationByOrderID(orderID)
}

// ListCargoDeclarations 获取客户的货物申报列表
func (s *ClientService) ListCargoDeclarations(clientID int64, page, pageSize int) ([]model.CargoDeclaration, int64, error) {
	return s.clientRepo.GetCargoDeclarationsByClientID(clientID, page, pageSize)
}

// UpdateCargoDeclaration 更新货物申报
func (s *ClientService) UpdateCargoDeclaration(clientID int64, declID int64, updates *model.CargoDeclaration) error {
	existing, err := s.clientRepo.GetCargoDeclarationByID(declID)
	if err != nil {
		return errors.New("申报单不存在")
	}

	if existing.ClientID != clientID {
		return errors.New("无权修改此申报单")
	}

	if existing.ComplianceStatus == "approved" {
		return errors.New("已审批通过的申报单不可修改")
	}

	// 更新允许修改的字段
	existing.CargoName = updates.CargoName
	existing.CargoDescription = updates.CargoDescription
	existing.Quantity = updates.Quantity
	existing.TotalWeight = updates.TotalWeight
	existing.Length = updates.Length
	existing.Width = updates.Width
	existing.Height = updates.Height
	existing.DeclaredValue = updates.DeclaredValue
	existing.ComplianceStatus = "pending" // 重新提交审核

	return s.clientRepo.UpdateCargoDeclaration(existing)
}

// ApproveCargoDeclaration 审批通过货物申报
func (s *ClientService) ApproveCargoDeclaration(declID int64, note string, approvedBy int64) error {
	return s.clientRepo.UpdateCargoDeclarationCompliance(declID, "approved", note, approvedBy)
}

// RejectCargoDeclaration 审批拒绝货物申报
func (s *ClientService) RejectCargoDeclaration(declID int64, note string, rejectedBy int64) error {
	return s.clientRepo.UpdateCargoDeclarationCompliance(declID, "rejected", note, rejectedBy)
}

// ListPendingCargoDeclarations 获取待审批的货物申报列表
func (s *ClientService) ListPendingCargoDeclarations(page, pageSize int) ([]model.CargoDeclaration, int64, error) {
	return s.clientRepo.ListPendingCargoDeclarations(page, pageSize)
}

// ==================== 客户验证管理 ====================

// ApproveClient 审批通过客户
func (s *ClientService) ApproveClient(clientID int64, note string) error {
	return s.clientRepo.ApproveVerification(clientID, note)
}

// RejectClient 审批拒绝客户
func (s *ClientService) RejectClient(clientID int64, note string) error {
	return s.clientRepo.RejectVerification(clientID, note)
}

// ApproveEnterpriseClient 审批通过企业客户
func (s *ClientService) ApproveEnterpriseClient(clientID int64, note string) error {
	return s.clientRepo.ApproveEnterpriseVerification(clientID, note)
}

// RejectEnterpriseClient 审批拒绝企业客户
func (s *ClientService) RejectEnterpriseClient(clientID int64, note string) error {
	return s.clientRepo.RejectEnterpriseVerification(clientID, note)
}

// ListPendingVerification 获取待审批客户列表
func (s *ClientService) ListPendingVerification(page, pageSize int) ([]model.Client, int64, error) {
	return s.clientRepo.ListPendingVerification(page, pageSize)
}

// ==================== 信用分管理 ====================

// UpdatePlatformCreditScore 更新平台信用分
func (s *ClientService) UpdatePlatformCreditScore(clientID int64, delta int, reason string) error {
	client, err := s.clientRepo.GetByID(clientID)
	if err != nil {
		return err
	}

	newScore := client.PlatformCreditScore + delta
	if newScore < 0 {
		newScore = 0
	}
	if newScore > 1000 {
		newScore = 1000
	}

	return s.clientRepo.UpdatePlatformCreditScore(clientID, newScore)
}

// CanPlaceOrder 检查客户是否可以下单
func (s *ClientService) CanPlaceOrder(clientID int64) (bool, string) {
	client, err := s.clientRepo.GetByID(clientID)
	if err != nil {
		return false, "客户档案不存在"
	}
	eligibility, err := s.GetCurrentEligibility(client.UserID)
	if err != nil {
		return false, err.Error()
	}
	if eligibility.CanCreateDirectOrder {
		return true, ""
	}
	if blocker := firstClientEligibilityBlocker(eligibility); blocker != nil {
		return false, blocker.Message
	}
	return false, "当前客户资格未就绪"
}

// ==================== 统计更新 ====================

// RecordOrderCompletion 记录订单完成
func (s *ClientService) RecordOrderCompletion(clientID int64, amount int64) error {
	return s.clientRepo.IncrementOrderStats(clientID, amount, true)
}

// RecordOrderCancellation 记录订单取消
func (s *ClientService) RecordOrderCancellation(clientID int64) error {
	return s.clientRepo.IncrementCancelledOrders(clientID)
}

// UpdateRating 更新评分
func (s *ClientService) UpdateRating(clientID int64, rating float64) error {
	return s.clientRepo.UpdateAverageRating(clientID, rating)
}

func (s *ClientService) requireCurrentEligibility(userID int64, action string) (*ClientEligibilityView, error) {
	eligibility, err := s.GetCurrentEligibility(userID)
	if err != nil {
		return nil, err
	}
	if isClientEligibilityActionAllowed(eligibility, action) {
		return eligibility, nil
	}
	if blocker := firstClientEligibilityBlocker(eligibility); blocker != nil {
		return eligibility, errors.New(blocker.Message)
	}
	return eligibility, errors.New("当前客户资格未就绪")
}

func buildClientEligibilityView(client *model.Client, user *model.User) *ClientEligibilityView {
	if client == nil {
		return nil
	}

	userStatus := "active"
	if user != nil && strings.TrimSpace(user.Status) != "" {
		userStatus = strings.TrimSpace(strings.ToLower(user.Status))
	}

	accountActive := client.Status == "active" && userStatus == "active"
	identityStatus := resolveClientIdentityVerificationStatus(client, user)
	identityVerified := identityStatus == "approved"
	creditQualified := client.PlatformCreditScore >= minClientPlatformCreditScore

	view := &ClientEligibilityView{
		AccountActive:             accountActive,
		IdentityVerified:          identityVerified,
		CreditQualified:           creditQualified,
		EnterpriseUpgradeOptional: true,
	}

	if !accountActive {
		view.Blockers = append(view.Blockers, ClientEligibilityBlocker{
			Code:            "account_inactive",
			Message:         "账号状态异常，暂时无法发布需求或直达下单",
			SuggestedAction: "contact_support",
		})
	}
	if !identityVerified {
		view.Blockers = append(view.Blockers, ClientEligibilityBlocker{
			Code:            "identity_verification_required",
			Message:         "请先完成实名认证后再发布需求或直达下单",
			SuggestedAction: "verify_identity",
		})
	}
	if !creditQualified {
		view.Blockers = append(view.Blockers, ClientEligibilityBlocker{
			Code:            "low_platform_credit",
			Message:         "平台信用分过低，暂时无法发布需求或直达下单",
			SuggestedAction: "repair_credit",
		})
	}

	view.CanPublishDemand = len(view.Blockers) == 0
	view.CanCreateDirectOrder = len(view.Blockers) == 0
	view.Eligible = view.CanPublishDemand && view.CanCreateDirectOrder
	view.Summary = buildClientEligibilitySummary(view)

	return view
}

func buildClientEligibilitySummary(view *ClientEligibilityView) string {
	if view == nil {
		return ""
	}
	if view.Eligible {
		return "个人实名认证通过后，可直接发布需求与直达下单；企业升级仅在需要企业主体出单时再补充。"
	}
	if blocker := firstClientEligibilityBlocker(view); blocker != nil {
		switch blocker.Code {
		case "identity_verification_required":
			return "完成实名认证后即可直接发布需求与直达下单，企业升级不是当前主链路的默认前置条件。"
		case "low_platform_credit":
			return "默认个人客户档案已开通，但当前需要先恢复平台信用分后再继续下单或发需求。"
		case "account_inactive":
			return "客户档案已创建，但账号状态异常，暂时无法继续下单或发需求。"
		}
	}
	return "默认个人客户档案已开通，企业升级不是当前主链路的默认前置条件。"
}

func firstClientEligibilityBlocker(view *ClientEligibilityView) *ClientEligibilityBlocker {
	if view == nil || len(view.Blockers) == 0 {
		return nil
	}
	return &view.Blockers[0]
}

func isClientEligibilityActionAllowed(view *ClientEligibilityView, action string) bool {
	if view == nil {
		return false
	}
	switch action {
	case clientEligibilityActionPublishDemand:
		return view.CanPublishDemand
	case clientEligibilityActionCreateDirectOrder, clientEligibilityActionSelectProvider:
		return view.CanCreateDirectOrder
	default:
		return view.Eligible
	}
}

func resolveClientIdentityVerificationStatus(client *model.Client, user *model.User) string {
	if user != nil {
		switch strings.ToLower(strings.TrimSpace(user.IDVerified)) {
		case "approved":
			return "approved"
		case "pending":
			return "pending"
		case "rejected":
			return "rejected"
		}
	}
	if client != nil {
		switch strings.ToLower(strings.TrimSpace(client.VerificationStatus)) {
		case "verified", "approved":
			return "approved"
		case "pending":
			return "pending"
		case "rejected":
			return "rejected"
		}
	}
	return "unverified"
}

func decodeClientStringSlice(raw model.JSON) []string {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	var items []string
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil
	}
	return items
}
