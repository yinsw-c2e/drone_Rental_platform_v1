export const registerApp = () => Promise.resolve(false);

export const isWXAppInstalled = () => Promise.resolve(false);

export const sendAuthRequest = () =>
  Promise.resolve({
    errCode: -2,
    code: '',
  });

export default {
  registerApp,
  isWXAppInstalled,
  sendAuthRequest,
};
