module.exports = {
    apps: [
        {name: 'frontend', cwd: '/opt/southward/frontend', script: 'npm', args: 'start', env: {NODE_ENV: 'production'}},
        {name: 'backend', cwd: '/opt/southward/backend', script: 'npm', args: 'start', env: {NODE_ENV: 'production'}},
        {
            name: 'fileservice',
            cwd: '/opt/southward/fileservice',
            script: 'npm',
            args: 'start',
            env: {NODE_ENV: 'production'},
            error_file: '/opt/southward/logs/fileservice-error.log',
            out_file: '/opt/southward/logs/fileservice-out.log'
        }
    ],
};