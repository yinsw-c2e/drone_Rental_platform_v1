package service

import "testing"

func TestShouldSendPushEvent(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name      string
		eventType string
		want      bool
	}{
		{name: "core order event", eventType: "order_paid", want: true},
		{name: "contract event", eventType: "contract_fully_signed", want: true},
		{name: "dispatch event", eventType: "dispatch_created", want: true},
		{name: "qualification event", eventType: "drone_uom_reviewed", want: true},
		{name: "non push event", eventType: "demand_quote_submitted", want: false},
		{name: "conversation only event", eventType: "dispatch_assigned", want: false},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			if got := shouldSendPushEvent(tc.eventType); got != tc.want {
				t.Fatalf("shouldSendPushEvent(%q) = %v, want %v", tc.eventType, got, tc.want)
			}
		})
	}
}
