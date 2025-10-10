{
  "apps": [
    {
      "name": "dpccgaming-backend",
      "script": "server.js",
      "cwd": "/www/wwwroot/dpccgaming.xyz",
      "instances": 1,
      "exec_mode": "fork",
      "env": {
        "NODE_ENV": "production",
        "PORT": 3000
      },
      "error_file": "/www/wwwlogs/dpccgaming-backend-error.log",
      "out_file": "/www/wwwlogs/dpccgaming-backend-out.log",
      "log_file": "/www/wwwlogs/dpccgaming-backend.log",
      "time": true,
      "autorestart": true,
      "watch": false,
      "max_memory_restart": "1G"
    }
  ]
}



