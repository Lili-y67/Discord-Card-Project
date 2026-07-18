const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = __dirname;
const npmCommand = process.platform == 'win32' ? 'npm.cmd' : 'npm';

const isDisabled = (name) => ['0', 'false', 'no', 'off'].includes((process.env[name] || '').toLowerCase());
const isEnabled = (name) => ['1', 'true', 'yes', 'on'].includes((process.env[name] || '').toLowerCase());

const run = (command, args, options = {}) => {
    console.log(`\n> ${command} ${args.join(' ')}`);
    const result = spawnSync(command, args, {
        cwd: projectRoot,
        stdio: options.silent ? 'pipe' : 'inherit',
        shell: false
    });

    if(result.error){
        if(options.optional){
            return result;
        }
        console.error(result.error);
        process.exit(1);
    }

    if(result.status != 0 && !options.optional){
        process.exit(result.status || 1);
    }

    return result;
};

const isGitRepository = () => {
    if(!fs.existsSync(path.join(projectRoot, '.git'))) return false;
    const result = run('git', ['rev-parse', '--is-inside-work-tree'], { optional: true, silent: true });
    return result.status == 0 && result.stdout?.toString().trim() == 'true';
};

const updateFromGit = () => {
    if(isDisabled('VPS_GIT_PULL')){
        console.log('VPS_GIT_PULL est désactivé, mise à jour Git ignorée.');
        return;
    }

    if(!isGitRepository()){
        console.log('Aucun dépôt Git détecté, mise à jour Git ignorée.');
        return;
    }

    run('git', ['fetch', '--all', '--prune']);
    run('git', ['pull', '--ff-only']);
};

const installDependencies = () => {
    if(isDisabled('VPS_NPM_INSTALL')){
        console.log('VPS_NPM_INSTALL est désactivé, installation npm ignorée.');
        return;
    }

    if(fs.existsSync(path.join(projectRoot, 'package-lock.json'))){
        run(npmCommand, ['ci', '--omit=dev']);
        return;
    }

    run(npmCommand, ['install', '--omit=dev']);
};

const deploySlashCommands = () => {
    if(isDisabled('VPS_DEPLOY_COMMANDS')){
        console.log('VPS_DEPLOY_COMMANDS est désactivé, déploiement des commandes ignoré.');
        return;
    }

    run(process.execPath, ['deploy-commands.js']);
};

const initDatabase = () => {
    if(isDisabled('VPS_INIT_DB')){
        console.log('VPS_INIT_DB est désactivé, initialisation DB ignorée.');
        return;
    }

    run(process.execPath, ['newDBinit.js']);
};

const startBot = () => {
    if(isEnabled('VPS_PREPARE_ONLY')){
        console.log('VPS_PREPARE_ONLY est activé, le bot ne sera pas lancé.');
        return;
    }

    run(process.execPath, ['index.js']);
};

updateFromGit();
installDependencies();
deploySlashCommands();
initDatabase();
startBot();
