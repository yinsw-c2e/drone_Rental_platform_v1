package model

import "testing"

func TestDroneMeetsHeavyLiftThreshold(t *testing.T) {
	drone := &Drone{
		MTOWKG:       150,
		MaxPayloadKG: 50,
	}
	if !drone.MeetsHeavyLiftThreshold() {
		t.Fatal("expected drone to meet heavy lift threshold")
	}

	drone.MaxPayloadKG = 49.9
	if drone.MeetsHeavyLiftThreshold() {
		t.Fatal("expected drone below payload threshold to fail")
	}
}

func TestDroneEligibleForMarketplaceRequiresAllApprovals(t *testing.T) {
	drone := &Drone{
		MTOWKG:                180,
		MaxPayloadKG:          70,
		AvailabilityStatus:    "available",
		CertificationStatus:   "approved",
		UOMVerified:           "verified",
		InsuranceVerified:     "verified",
		AirworthinessVerified: "verified",
	}
	if !drone.EligibleForMarketplace() {
		t.Fatal("expected fully approved heavy-lift drone to be eligible")
	}

	drone.UOMVerified = "pending"
	if drone.EligibleForMarketplace() {
		t.Fatal("expected missing UOM verification to make drone ineligible")
	}
}
