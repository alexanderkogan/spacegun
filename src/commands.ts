import { ClusterProvider } from "@/cluster/Cluster"
import { pad } from "./pad"
import chalk from "chalk"

import * as ora from "ora"
import { ImageProvider } from "@/images/ImageProvider";

export type Command = "pods" | "deployments" | "scalers" | "help"

async function load<T>(p: Promise<T>): Promise<T> {
    const progress = ora()
    progress.start("loading")
    const result = await p
    progress.stop()
    return result
}

async function foreachCluster(clusterProvider: ClusterProvider, f: (clusterProvider: ClusterProvider, cluster: string) => void) {
    for (const cluster of clusterProvider.clusters) {
        console.log("")
        console.log(chalk.underline.bold(pad(`${cluster}`)))
        await f(clusterProvider, cluster)
    }
}

async function podsCommand(clusterProvider: ClusterProvider, cluster: string) {
    const pods = await load(clusterProvider.pods(cluster))
    console.log(chalk.bold(pad("pod name", 5) + pad("tag name", 5) + pad("restarts", 2)))
    pods.forEach(pod => {
        let restartText = pod.restarts.toString()
        if (pod.restarts > 30) {
            restartText = chalk.bold.cyan(pad(restartText + "!", 2))
        } else if (pod.restarts > 10) {
            restartText = chalk.bold.magenta(pad(restartText, 2))
        } else {
            restartText = pad(restartText, 2)
        }
        console.log(pad(pod.name, 5) + pad(pod.image.tag, 5) + restartText)
    })
}

async function deployementsCommand(clusterProvider: ClusterProvider, cluster: string) {
    const deployments = await load(clusterProvider.deployments(cluster))
    console.log(chalk.bold(pad("deployment name", 5) + pad("tag name", 7)))
    deployments.forEach(deployment => {
        console.log(pad(deployment.name, 5) + pad(deployment.image.tag, 7))
    })
}

async function scalersCommand(clusterProvider: ClusterProvider, cluster: string) {
    const scalers = await load(clusterProvider.scalers(cluster))
    console.log(chalk.bold(pad("scaler name", 5) + pad("replication", 7)))
    console.log(chalk.bold(pad("", 5) + pad("current", 3) + pad("minimum", 2) + pad("maximum", 2)))
    scalers.forEach(scaler => {
        let line = pad(scaler.name, 5)
        let currentText = scaler.replicas.current.toString()
        if (scaler.replicas.current < scaler.replicas.minimum) {
            currentText = chalk.bold.cyan(pad(currentText + "!", 3))
        } else if (scaler.replicas.current >= scaler.replicas.maximum) {
            currentText = chalk.bold.magenta(pad(currentText, 3))
        } else {
            currentText = pad(currentText, 3)
        }
        line += currentText
        line += pad(scaler.replicas.minimum.toString(), 2) + pad(scaler.replicas.maximum.toString(), 2)
        console.log(line)
    })
}

export function printHelp(clusterProvider?: ClusterProvider, imageProvider?: ImageProvider, invalidConfig: boolean = false) {
    const b = chalk.blue;
    const m = chalk.magenta;
    const c = chalk.cyan;
    const CLI_TITLE = chalk.bold.underline('Spacegun-CLI')
    const CLI_DESCRIPTION = 'Space age deployment manager'
    const CLI_USAGE = 'Usage: \`spacegun <command> [options ...]\`'

    const HELP_HEADER = `
        ${b('/\\')} ${c('*')}    
       ${b('/__\\')}     ${CLI_TITLE}
      ${b('/\\  /')}
     ${b('/__\\/')}      ${CLI_DESCRIPTION}
    ${b('/\\')}  ${m('/\\')}     
   ${ b('/__\\')}${m('/__\\')}     ${CLI_USAGE}
  ${ b('/\\')}  ${m('/')}    ${m('\\')}
`
    console.log(HELP_HEADER)
    if (invalidConfig) {
        console.log(c('no configuration file found!'))
        console.log(c('A config.yml containing the following line might be sufficient'))
        console.log(b('docker: http://your.docker.registry/'))
        console.log("")
    }
    if (clusterProvider !== undefined) {
        console.log('configured clusters: ' + m(clusterProvider.clusters.join(", ")))
    } else {
        console.log(c('no clusters configured! (such as your kubernetes)'))
    }
    if (imageProvider !== undefined) {
        console.log('configured image endpoint: ' + m(imageProvider.endpoint))
    } else {
        console.log(c('no image registry configured! (such as your docker registry)'))
    }

    console.log('')
    console.log(chalk.bold.underline('Available Commands'))
    console.log(pad("pods", 2) + chalk.bold(pad("a summary of all pods of all known clusters", 10)))
    console.log(pad("deployments", 2) + chalk.bold(pad("a summary of all deployements of all known clusters", 10)))
    console.log(pad("scalers", 2) + chalk.bold(pad("a summary of all scalers of all known clusters", 10)))
    console.log(pad("help", 2) + chalk.bold(pad("renders this summary", 10)))
    console.log('')
    console.log(chalk.bold.underline('Available Options'))
    console.log(pad("config, c", 2) + chalk.bold(pad("path to the config.yml. Default: `config.yml`", 10)))
}

const commands: { [k in Command]: (clusterProvider: ClusterProvider, imageProvider: ImageProvider) => Promise<void> } = {
    "pods": async (clusterProvider: ClusterProvider, { }: ImageProvider) => {
        foreachCluster(clusterProvider, podsCommand)
    },
    "deployments": async (clusterProvider: ClusterProvider, { }: ImageProvider) => {
        foreachCluster(clusterProvider, deployementsCommand)
    },
    "scalers": async (clusterProvider: ClusterProvider, { }: ImageProvider) => {
        foreachCluster(clusterProvider, scalersCommand)
    },
    "help": async (clusterProvider: ClusterProvider, imageProvider: ImageProvider) => {
        printHelp(clusterProvider, imageProvider)
    }
}

export { commands }