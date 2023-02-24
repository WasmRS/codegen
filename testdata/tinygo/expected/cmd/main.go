package main

import (
	"github.com/nanobus/iota/go/transport/wasmrs/guest"

	"github.com/nanobus/iota/testing/iotatest/pkg/iotatest"
)

func main() {
	// Create providers
	deps := iotatest.GetDependencies(guest.HostInvoker)

	// Create services
	myStreamerService := iotatest.NewMyStreamer(deps)
	myServiceService := iotatest.NewMyService(deps)

	// Register services
	iotatest.RegisterSomeCalc(iotatest.SomeCalc)
	iotatest.RegisterMyStreamer(myStreamerService)
	iotatest.RegisterMyService(myServiceService)
}
