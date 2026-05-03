const Geolocation = {
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(() => 1),
  clearWatch: jest.fn(),
  stopObserving: jest.fn(),
  setRNConfiguration: jest.fn(),
  requestAuthorization: jest.fn(() => Promise.resolve('granted')),
};

export default Geolocation;
