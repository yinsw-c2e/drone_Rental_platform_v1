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
		{name: "settlement event", eventType: "settlement_settled", want: true},
		{name: "qualification event", eventType: "drone_uom_reviewed", want: true},
		{name: "demand quote event", eventType: "demand_quote_submitted", want: true},
		{name: "demand selected event", eventType: "demand_selected", want: true},
		{name: "demand cancelled event", eventType: "demand_cancelled", want: true},
		{name: "order cancelled event", eventType: "order_cancelled", want: true},
		{name: "order completed event", eventType: "order_completed", want: true},
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
