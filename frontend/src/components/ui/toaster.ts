import { createToaster, Toaster } from '@chakra-ui/react';

export const toaster = createToaster({ placement: 'top-end', pauseOnPageIdle: true });
export { Toaster };
