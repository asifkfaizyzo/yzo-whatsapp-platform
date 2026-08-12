module.exports = {
  apps: [
    {
      name: 'sudoreply-backend',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      kill_timeout: 10000, // Gives BullMQ workers up to 10 seconds to finish active jobs during PM2 reload/restart
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
