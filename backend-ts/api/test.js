export default function handler(req, res) {
  res.json({
    status: 'ok',
    message: 'TypeScript backend test endpoint',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}
