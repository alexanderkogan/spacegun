import { Deployment } from '../../cluster/model/Deployment'
import { Image } from '../../cluster/model/Image'
import { ServerGroup } from '../../cluster/model/ServerGroup'
import { Batch } from 'src/cluster/model/Batch'

export type DeployableResource = Deployment | Batch

export interface DeploymentPlan<T extends DeployableResource> {
    deployable: T
    image: Image
    group: ServerGroup
}
