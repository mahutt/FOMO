export const SERVER_URL =
  import.meta.env.MODE === 'development'
    ? 'http://localhost:8000'
    : 'https://335guy.com'
