export type StepType = "clusterProbe" | "planImageDeployment" | "planClusterDeployment" | "applyDeployment" | "takeSnapshot" | "rollback"

export interface StepDescription {
    readonly name: string
    readonly type: StepType
    readonly onSuccess?: string
    readonly onFailure?: string

    readonly tag?: string       // planImageDeployment
    readonly cluster?: string   // planClusterDeployment
    readonly hook?: string      // clusterProbe
}
