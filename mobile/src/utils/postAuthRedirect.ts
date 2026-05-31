type PostAuthRedirect = {
  name: string;
  params?: Record<string, unknown>;
};

let pendingPostAuthRedirect: PostAuthRedirect | null = null;

export const setPostAuthRedirect = (redirect: PostAuthRedirect) => {
  pendingPostAuthRedirect = redirect;
};

export const consumePostAuthRedirect = () => {
  const redirect = pendingPostAuthRedirect;
  pendingPostAuthRedirect = null;
  return redirect;
};
