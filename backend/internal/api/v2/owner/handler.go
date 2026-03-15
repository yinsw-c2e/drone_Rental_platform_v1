package owner

import (
	"encoding/json"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"wurenji-backend/internal/api/middleware"
	v2common "wurenji-backend/internal/api/v2/common"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/pkg/response"
	"wurenji-backend/internal/service"
)

type Handler struct {
	ownerService *service.OwnerService
	droneService *service.DroneService
}

func NewHandler(ownerService *service.OwnerService, droneService *service.DroneService) *Handler {
	return &Handler{
		ownerService: ownerService,
		droneService: droneService,
	}
}

func (h *Handler) GetProfile(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	profile, err := h.ownerService.GetProfile(userID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, profile)
}

func (h *Handler) UpdateProfile(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	var req service.OwnerProfileInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid owner profile payload")
		return
	}

	profile, err := h.ownerService.UpdateProfile(userID, &req)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, profile)
}

func (h *Handler) ListDrones(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	page, pageSize := middleware.GetPagination(c)
	drones, total, err := h.ownerService.ListMyDrones(userID, page, pageSize)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items := make([]gin.H, 0, len(drones))
	for i := range drones {
		items = append(items, buildDroneSummary(&drones[i]))
	}
	response.V2SuccessList(c, items, total)
}

func (h *Handler) CreateDrone(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	var drone model.Drone
	if err := c.ShouldBindJSON(&drone); err != nil {
		response.V2ValidationError(c, "invalid drone payload")
		return
	}
	drone.OwnerID = userID
	sanitizeDroneForOwnerCreate(&drone)

	if err := h.droneService.Create(&drone); err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildDroneDetail(&drone, nil))
}

func sanitizeDroneForOwnerCreate(drone *model.Drone) {
	if drone == nil {
		return
	}
	drone.CertificationStatus = "pending"
	drone.UOMRegistrationNo = ""
	drone.UOMVerified = "pending"
	drone.UOMRegistrationDoc = ""
	drone.InsurancePolicyNo = ""
	drone.InsuranceCompany = ""
	drone.InsuranceCoverage = 0
	drone.InsuranceExpireDate = nil
	drone.InsuranceDoc = ""
	drone.InsuranceVerified = "pending"
	drone.AirworthinessCertNo = ""
	drone.AirworthinessCertExpire = nil
	drone.AirworthinessCertDoc = ""
	drone.AirworthinessVerified = "pending"
	if drone.AvailabilityStatus == "" {
		drone.AvailabilityStatus = "available"
	}
}

func (h *Handler) GetDrone(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	droneID, err := strconv.ParseInt(c.Param("drone_id"), 10, 64)
	if err != nil || droneID <= 0 {
		response.V2ValidationError(c, "invalid drone_id")
		return
	}

	drone, err := h.ownerService.GetOwnedDrone(userID, droneID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	certStatus, err := h.droneService.GetCertificationStatus(droneID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildDroneDetail(drone, certStatus))
}

func (h *Handler) SubmitDroneCertification(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	droneID, err := strconv.ParseInt(c.Param("drone_id"), 10, 64)
	if err != nil || droneID <= 0 {
		response.V2ValidationError(c, "invalid drone_id")
		return
	}

	var req struct {
		CertType         string     `json:"cert_type" binding:"required"`
		Docs             model.JSON `json:"docs"`
		RegistrationNo   string     `json:"registration_no"`
		RegistrationDoc  string     `json:"registration_doc"`
		PolicyNo         string     `json:"policy_no"`
		InsuranceCompany string     `json:"insurance_company"`
		CoverageAmount   int64      `json:"coverage_amount"`
		ExpireDate       *time.Time `json:"expire_date"`
		InsuranceDoc     string     `json:"insurance_doc"`
		CertNo           string     `json:"cert_no"`
		CertDoc          string     `json:"cert_doc"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid certification payload")
		return
	}

	switch req.CertType {
	case "basic_certification":
		if len(req.Docs) == 0 {
			response.V2ValidationError(c, "docs is required")
			return
		}
		if err := h.droneService.SubmitCertification(userID, droneID, req.Docs); err != nil {
			v2common.HandleServiceError(c, err)
			return
		}
	case "uom_registration":
		if req.RegistrationNo == "" || req.RegistrationDoc == "" {
			response.V2ValidationError(c, "registration_no and registration_doc are required")
			return
		}
		if err := h.droneService.SubmitUOMRegistration(userID, droneID, &service.SubmitUOMRegistrationReq{
			RegistrationNo:  req.RegistrationNo,
			RegistrationDoc: req.RegistrationDoc,
		}); err != nil {
			v2common.HandleServiceError(c, err)
			return
		}
	case "insurance":
		if req.ExpireDate == nil {
			response.V2ValidationError(c, "expire_date is required")
			return
		}
		if req.PolicyNo == "" || req.InsuranceCompany == "" || req.InsuranceDoc == "" || req.CoverageAmount <= 0 {
			response.V2ValidationError(c, "policy_no, insurance_company, coverage_amount and insurance_doc are required")
			return
		}
		if err := h.droneService.SubmitInsurance(userID, droneID, &service.SubmitInsuranceReq{
			PolicyNo:         req.PolicyNo,
			InsuranceCompany: req.InsuranceCompany,
			CoverageAmount:   req.CoverageAmount,
			ExpireDate:       req.ExpireDate,
			InsuranceDoc:     req.InsuranceDoc,
		}); err != nil {
			v2common.HandleServiceError(c, err)
			return
		}
	case "airworthiness":
		if req.ExpireDate == nil {
			response.V2ValidationError(c, "expire_date is required")
			return
		}
		if req.CertNo == "" || req.CertDoc == "" {
			response.V2ValidationError(c, "cert_no and cert_doc are required")
			return
		}
		if err := h.droneService.SubmitAirworthiness(userID, droneID, &service.SubmitAirworthinessReq{
			CertNo:     req.CertNo,
			ExpireDate: req.ExpireDate,
			CertDoc:    req.CertDoc,
		}); err != nil {
			v2common.HandleServiceError(c, err)
			return
		}
	default:
		response.V2ValidationError(c, "unsupported cert_type")
		return
	}

	certStatus, err := h.droneService.GetCertificationStatus(droneID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, certStatus)
}

func (h *Handler) ListSupplies(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	page, pageSize := middleware.GetPagination(c)
	status := c.Query("status")

	supplies, total, err := h.ownerService.ListMySupplies(userID, status, page, pageSize)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items := make([]gin.H, 0, len(supplies))
	for i := range supplies {
		items = append(items, buildOwnerSupplySummary(&supplies[i]))
	}
	response.V2SuccessList(c, items, total)
}

func (h *Handler) CreateSupply(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	var req service.OwnerSupplyInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid owner supply payload")
		return
	}

	supply, err := h.ownerService.CreateSupply(userID, &req)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildOwnerSupplyDetail(supply))
}

func (h *Handler) GetSupply(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	supplyID, err := strconv.ParseInt(c.Param("supply_id"), 10, 64)
	if err != nil || supplyID <= 0 {
		response.V2ValidationError(c, "invalid supply_id")
		return
	}

	supply, err := h.ownerService.GetSupply(userID, supplyID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildOwnerSupplyDetail(supply))
}

func (h *Handler) UpdateSupply(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	supplyID, err := strconv.ParseInt(c.Param("supply_id"), 10, 64)
	if err != nil || supplyID <= 0 {
		response.V2ValidationError(c, "invalid supply_id")
		return
	}

	var req service.OwnerSupplyInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid owner supply payload")
		return
	}

	supply, err := h.ownerService.UpdateSupply(userID, supplyID, &req)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildOwnerSupplyDetail(supply))
}

func (h *Handler) UpdateSupplyStatus(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	supplyID, err := strconv.ParseInt(c.Param("supply_id"), 10, 64)
	if err != nil || supplyID <= 0 {
		response.V2ValidationError(c, "invalid supply_id")
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid supply status payload")
		return
	}

	supply, err := h.ownerService.UpdateSupplyStatus(userID, supplyID, req.Status)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildOwnerSupplyDetail(supply))
}

func (h *Handler) ListRecommendedDemands(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	page, pageSize := middleware.GetPagination(c)
	demands, total, err := h.ownerService.ListRecommendedDemands(userID, page, pageSize)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	demandIDs := make([]int64, 0, len(demands))
	for i := range demands {
		demandIDs = append(demandIDs, demands[i].ID)
	}
	stats, err := h.ownerService.GetDemandStats(demandIDs)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items := make([]gin.H, 0, len(demands))
	for i := range demands {
		items = append(items, buildDemandSummary(&demands[i], stats[demands[i].ID]))
	}
	response.V2SuccessList(c, items, total)
}

func (h *Handler) CreateQuote(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	demandID, err := strconv.ParseInt(c.Param("demand_id"), 10, 64)
	if err != nil || demandID <= 0 {
		response.V2ValidationError(c, "invalid demand_id")
		return
	}

	var req service.CreateQuoteInput
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid quote payload")
		return
	}

	quote, err := h.ownerService.CreateDemandQuote(userID, demandID, &req)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildQuoteSummary(quote))
}

func (h *Handler) ListQuotes(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	page, pageSize := middleware.GetPagination(c)
	status := c.Query("status")

	quotes, total, err := h.ownerService.ListMyQuotes(userID, status, page, pageSize)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items := make([]gin.H, 0, len(quotes))
	for i := range quotes {
		items = append(items, buildQuoteSummary(&quotes[i]))
	}
	response.V2SuccessList(c, items, total)
}

func (h *Handler) ListPilotBindings(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	page, pageSize := middleware.GetPagination(c)
	status := c.Query("status")

	bindings, total, err := h.ownerService.ListPilotBindings(userID, status, page, pageSize)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}

	items := make([]gin.H, 0, len(bindings))
	for i := range bindings {
		items = append(items, buildBindingSummary(&bindings[i]))
	}
	response.V2SuccessList(c, items, total)
}

func (h *Handler) InvitePilotBinding(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	var req struct {
		PilotUserID int64  `json:"pilot_user_id" binding:"required"`
		IsPriority  bool   `json:"is_priority"`
		Note        string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid pilot binding payload")
		return
	}

	binding, err := h.ownerService.InvitePilotBinding(userID, req.PilotUserID, req.IsPriority, req.Note)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildBindingSummary(binding))
}

func (h *Handler) ConfirmPilotBinding(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	bindingID, ok := parseBindingID(c)
	if !ok {
		return
	}

	binding, err := h.ownerService.ConfirmPilotBinding(userID, bindingID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildBindingSummary(binding))
}

func (h *Handler) RejectPilotBinding(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	bindingID, ok := parseBindingID(c)
	if !ok {
		return
	}

	binding, err := h.ownerService.RejectPilotBinding(userID, bindingID)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildBindingSummary(binding))
}

func (h *Handler) UpdatePilotBindingStatus(c *gin.Context) {
	userID := middleware.GetUserID(c)
	if userID == 0 {
		response.V2Unauthorized(c, "missing user context")
		return
	}

	bindingID, ok := parseBindingID(c)
	if !ok {
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.V2ValidationError(c, "invalid pilot binding status payload")
		return
	}

	binding, err := h.ownerService.UpdatePilotBindingStatus(userID, bindingID, req.Status)
	if err != nil {
		v2common.HandleServiceError(c, err)
		return
	}
	response.V2Success(c, buildBindingSummary(binding))
}

func parseBindingID(c *gin.Context) (int64, bool) {
	bindingID, err := strconv.ParseInt(c.Param("binding_id"), 10, 64)
	if err != nil || bindingID <= 0 {
		response.V2ValidationError(c, "invalid binding_id")
		return 0, false
	}
	return bindingID, true
}

func buildDroneSummary(drone *model.Drone) gin.H {
	if drone == nil {
		return gin.H{}
	}
	return gin.H{
		"id":                     drone.ID,
		"brand":                  drone.Brand,
		"model":                  drone.Model,
		"serial_number":          drone.SerialNumber,
		"mtow_kg":                drone.MTOWKG,
		"max_payload_kg":         drone.EffectivePayloadKG(),
		"city":                   drone.City,
		"availability_status":    drone.AvailabilityStatus,
		"certification_status":   drone.CertificationStatus,
		"uom_verified":           drone.UOMVerified,
		"insurance_verified":     drone.InsuranceVerified,
		"airworthiness_verified": drone.AirworthinessVerified,
	}
}

func buildDroneDetail(drone *model.Drone, certStatus map[string]interface{}) gin.H {
	data := buildDroneSummary(drone)
	if drone == nil {
		return data
	}
	data["owner_id"] = drone.OwnerID
	data["description"] = drone.Description
	data["latitude"] = drone.Latitude
	data["longitude"] = drone.Longitude
	data["address"] = drone.Address
	data["uom_registration_no"] = drone.UOMRegistrationNo
	data["insurance_policy_no"] = drone.InsurancePolicyNo
	data["insurance_company"] = drone.InsuranceCompany
	data["insurance_expire_date"] = drone.InsuranceExpireDate
	data["airworthiness_cert_no"] = drone.AirworthinessCertNo
	data["airworthiness_cert_expire"] = drone.AirworthinessCertExpire
	data["created_at"] = drone.CreatedAt
	data["updated_at"] = drone.UpdatedAt
	if certStatus != nil {
		data["certification_overview"] = certStatus
	}
	return data
}

func buildOwnerSupplySummary(supply *model.OwnerSupply) gin.H {
	if supply == nil {
		return gin.H{}
	}
	data := gin.H{
		"id":                   supply.ID,
		"supply_no":            supply.SupplyNo,
		"title":                supply.Title,
		"drone_id":             supply.DroneID,
		"service_types":        v2common.SafeJSONValue(supply.ServiceTypes),
		"cargo_scenes":         v2common.SafeJSONValue(supply.CargoScenes),
		"mtow_kg":              supply.MTOWKG,
		"max_payload_kg":       supply.MaxPayloadKG,
		"base_price_amount":    supply.BasePriceAmount,
		"pricing_unit":         supply.PricingUnit,
		"accepts_direct_order": supply.AcceptsDirectOrder,
		"status":               supply.Status,
		"updated_at":           supply.UpdatedAt,
	}
	if supply.Drone != nil {
		data["drone"] = buildDroneSummary(supply.Drone)
	}
	return data
}

func buildOwnerSupplyDetail(supply *model.OwnerSupply) gin.H {
	data := buildOwnerSupplySummary(supply)
	if supply == nil {
		return data
	}
	data["description"] = supply.Description
	data["service_area_snapshot"] = v2common.SafeJSONValue(supply.ServiceAreaSnapshot)
	data["pricing_rule"] = v2common.SafeJSONValue(supply.PricingRule)
	data["available_time_slots"] = v2common.SafeJSONValue(supply.AvailableTimeSlots)
	data["created_at"] = supply.CreatedAt
	return data
}

func buildDemandSummary(demand *model.Demand, stats service.DemandStats) gin.H {
	if demand == nil {
		return gin.H{}
	}
	return gin.H{
		"id":                     demand.ID,
		"demand_no":              demand.DemandNo,
		"title":                  demand.Title,
		"status":                 demand.Status,
		"service_type":           demand.ServiceType,
		"cargo_scene":            demand.CargoScene,
		"service_address_text":   extractOwnerAddressText(demand.ServiceAddressSnapshot, demand.DepartureAddressSnapshot, demand.DestinationAddressSnapshot),
		"scheduled_start_at":     demand.ScheduledStartAt,
		"scheduled_end_at":       demand.ScheduledEndAt,
		"budget_min":             demand.BudgetMin,
		"budget_max":             demand.BudgetMax,
		"allows_pilot_candidate": demand.AllowsPilotCandidate,
		"quote_count":            stats.QuoteCount,
		"candidate_pilot_count":  stats.CandidatePilotCount,
	}
}

func buildQuoteSummary(quote *model.DemandQuote) gin.H {
	if quote == nil {
		return gin.H{}
	}
	data := gin.H{
		"id":             quote.ID,
		"quote_no":       quote.QuoteNo,
		"demand_id":      quote.DemandID,
		"owner_user_id":  quote.OwnerUserID,
		"price_amount":   quote.PriceAmount,
		"status":         quote.Status,
		"created_at":     quote.CreatedAt,
		"execution_plan": quote.ExecutionPlan,
	}
	if quote.Demand != nil {
		data["demand"] = gin.H{
			"id":        quote.Demand.ID,
			"demand_no": quote.Demand.DemandNo,
			"title":     quote.Demand.Title,
			"status":    quote.Demand.Status,
		}
	}
	if quote.Drone != nil {
		data["drone"] = buildDroneSummary(quote.Drone)
	}
	return data
}

func buildBindingSummary(binding *model.OwnerPilotBinding) gin.H {
	if binding == nil {
		return gin.H{}
	}
	data := gin.H{
		"id":            binding.ID,
		"owner_user_id": binding.OwnerUserID,
		"pilot_user_id": binding.PilotUserID,
		"initiated_by":  binding.InitiatedBy,
		"status":        binding.Status,
		"is_priority":   binding.IsPriority,
		"note":          binding.Note,
		"confirmed_at":  binding.ConfirmedAt,
		"dissolved_at":  binding.DissolvedAt,
		"created_at":    binding.CreatedAt,
		"updated_at":    binding.UpdatedAt,
	}
	if binding.Pilot != nil {
		data["pilot"] = gin.H{
			"id":         binding.Pilot.ID,
			"nickname":   binding.Pilot.Nickname,
			"avatar_url": binding.Pilot.AvatarURL,
		}
	}
	return data
}

func extractOwnerAddressText(candidates ...model.JSON) string {
	for _, snapshot := range candidates {
		if len(snapshot) == 0 {
			continue
		}
		var payload struct {
			Text string `json:"text"`
		}
		if err := json.Unmarshal(snapshot, &payload); err == nil && payload.Text != "" {
			return payload.Text
		}
	}
	return ""
}
