package service

import (
	"testing"

	"go.uber.org/zap"
	"wurenji-backend/internal/model"
	"wurenji-backend/internal/repository"
)

func TestScorePairPrefersHigherCreditWhenOtherFactorsEqual(t *testing.T) {
	service := NewDispatchService(nil, nil, nil, nil, nil, nil, nil, nil, zap.NewNop())
	task := &model.DispatchTask{
		CargoWeight:    80,
		FlightDistance: 12,
		BudgetMin:      10000,
		BudgetMax:      50000,
	}

	basePair := repository.PilotDronePair{
		PilotID:          1,
		DroneID:          1,
		OwnerID:          1,
		MaxLoad:          120,
		Distance:         4,
		CAACLicenseType:  "BVLOS",
		TotalFlightHours: 800,
		MaxDistance:      30,
		PilotRating:      5,
		DroneRating:      5,
		PilotCreditScore: 850,
	}

	highCredit := service.scorePair(task, &basePair)

	lowCreditPair := basePair
	lowCreditPair.PilotID = 2
	lowCreditPair.PilotCreditScore = 420
	lowCredit := service.scorePair(task, &lowCreditPair)

	if highCredit.TotalScore <= lowCredit.TotalScore {
		t.Fatalf("expected high credit candidate to score higher, got high=%d low=%d", highCredit.TotalScore, lowCredit.TotalScore)
	}
	if highCredit.CreditScore <= lowCredit.CreditScore {
		t.Fatalf("expected high credit score bucket to exceed low bucket, got high=%d low=%d", highCredit.CreditScore, lowCredit.CreditScore)
	}
}

func TestSortDispatchPilotOptionsPrefersHigherCreditWithinSameSource(t *testing.T) {
	options := []dispatchPilotOption{
		{
			PilotUserID:   2,
			Source:        "general_pool",
			CreditScore:   420,
			ServiceRating: 4.8,
			Distance:      3,
		},
		{
			PilotUserID:   1,
			Source:        "general_pool",
			CreditScore:   860,
			ServiceRating: 4.8,
			Distance:      6,
		},
	}

	for i := range options {
		options[i].SortWeight = buildDispatchPilotOptionSortWeight(options[i])
	}
	sortDispatchPilotOptions(options)

	if options[0].PilotUserID != 1 {
		t.Fatalf("expected higher credit pilot to rank first, got pilot_user_id=%d", options[0].PilotUserID)
	}
	if options[0].SortWeight <= options[1].SortWeight {
		t.Fatalf("expected higher credit pilot to have greater sort weight, got first=%d second=%d", options[0].SortWeight, options[1].SortWeight)
	}
}

func TestSortDispatchPilotOptionsPreservesSourcePriorityOverCredit(t *testing.T) {
	options := []dispatchPilotOption{
		{
			PilotUserID:   1,
			Source:        "general_pool",
			CreditScore:   980,
			ServiceRating: 5,
			Distance:      1,
		},
		{
			PilotUserID:   2,
			Source:        "candidate_pool",
			CreditScore:   450,
			ServiceRating: 4.2,
			Distance:      12,
		},
	}

	for i := range options {
		options[i].SortWeight = buildDispatchPilotOptionSortWeight(options[i])
	}
	sortDispatchPilotOptions(options)

	if options[0].PilotUserID != 2 {
		t.Fatalf("expected candidate pool pilot to outrank general pool pilot, got pilot_user_id=%d", options[0].PilotUserID)
	}
}

func TestSortDispatchPilotOptionsPreservesBoundPriorityBeforeCredit(t *testing.T) {
	options := []dispatchPilotOption{
		{
			PilotUserID:     1,
			Source:          "bound_pilot",
			BindingPriority: false,
			CreditScore:     900,
			ServiceRating:   4.9,
			Distance:        3,
		},
		{
			PilotUserID:     2,
			Source:          "bound_pilot",
			BindingPriority: true,
			CreditScore:     620,
			ServiceRating:   4.4,
			Distance:        8,
		},
	}

	for i := range options {
		options[i].SortWeight = buildDispatchPilotOptionSortWeight(options[i])
	}
	sortDispatchPilotOptions(options)

	if options[0].PilotUserID != 2 {
		t.Fatalf("expected priority bound pilot to rank first, got pilot_user_id=%d", options[0].PilotUserID)
	}
}
