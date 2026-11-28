// Short-lived token that opens the application-status page for a company that cannot sign in yet.
const KEY = 'b2b-application-token';

export const getApplicationToken = () => sessionStorage.getItem(KEY) || '';
export const saveApplicationToken = (token) => sessionStorage.setItem(KEY, token);
export const clearApplicationToken = () => sessionStorage.removeItem(KEY);
