export const registerApp = jest.fn(() => Promise.resolve(true));
export const isWXAppInstalled = jest.fn(() => Promise.resolve(false));
export const sendAuthRequest = jest.fn(() => Promise.resolve({errCode: -1}));

export default {
  registerApp,
  isWXAppInstalled,
  sendAuthRequest,
};
