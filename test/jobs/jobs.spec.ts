jest.useFakeTimers()

import { Request } from "../../src/dispatcher/model/Request"
import { Layers } from "../../src/dispatcher/model/Layers"
process.env.LAYER = Layers.Standalone

import { Job } from "../../src/jobs/model/Job"
import { CronRegistry } from "../../src/crons/CronRegistry"

const deployments = {
    "cluster1": [
        { name: "service1", image: { name: "image1", tag: "tag2" } }
    ],
    "cluster2": [
        { name: "service1", image: { name: "image1", tag: "tag1" } }
    ],
}
const namespaces = {
    "cluster1": [],
    "cluster2": ["service1"]
}

const versions = {
    "image1": [
        { name: "image1", tag: "tag3" }
    ]
}

const updateDeploymentMock = jest.fn()

import * as dispatcher from "../../src/dispatcher"
dispatcher.call = (request: Request<any, any>) => {
    switch (request.module) {
        case "cluster": {
            switch (request.procedure) {
                case "deployments": {
                    return (input: { cluster: string }) => (deployments[input.cluster])
                }
                case "deployments": {
                    return (input: { cluster: string }) => (deployments[input.cluster])
                }
                case "namespaces": {
                    return (input: { cluster: string }) => (namespaces[input.cluster])
                }
                case "updateDeployment": {
                    return (input: any) => {
                        updateDeploymentMock(input)
                        return deployments[input.group.cluster]
                    }
                }
            }
        }
        case "images": {
            switch (request.procedure) {
                case "versions": {
                    return (input: { name: string }) => (versions[input.name])
                }
            }
        }
    }
}

import { JobsRepositoryImpl } from "../../src/jobs/JobsRepositoryImpl"

describe("JobsRepositoryImpl", () => {

    let repo: JobsRepositoryImpl
    let crons: CronRegistry
    const twelvePMEveryWorkday = "0 0 0 12 * * MON-FRI"
    const everyMinuteEveryWorkday = "0 */5 * * * MON-FRI"
    const job1: Job = { name: "1->2", cluster: "cluster2", from: { type: "cluster", expression: "cluster1" }, cron: twelvePMEveryWorkday }
    const job2: Job = { name: "i->1", cluster: "cluster1", from: { type: "image", expression: "^(?!.*latest).*$" }, cron: everyMinuteEveryWorkday }

    beforeEach(() => {
        process.env.LAYER = Layers.Server

        const jobs = new Map()
        jobs.set("1->2", job1)
        jobs.set("i->1", job2)

        jest.mock("../../src/dispatcher/index", () => ({
            get: jest.fn()
        }))

        crons = new CronRegistry()
        repo = new JobsRepositoryImpl(jobs, crons)
    })

    it("registers the job names", () => {
        expect(repo.list).toEqual([job1, job2])
    })

    describe("cron jobs", () => {

        it("updates lastRun", () => {
            expect(repo.crons[0].lastRun).toBeUndefined()
            expect(repo.crons[1].lastRun).toBeUndefined()
            crons.cronJobs.get("1->2").start()
            jest.runOnlyPendingTimers()
            expect(repo.crons[0].lastRun).toBeDefined()
            expect(repo.crons[1].lastRun).toBeUndefined()
        })

        it("shows next five runs", () => {
            expect(repo.crons[0].nextRuns).toEqual(
                [1520942400000, 1521028800000, 1521115200000, 1521201600000, 1521460800000]
            )
            expect(repo.crons[1].nextRuns).toEqual(
                [1520899200000, 1520899500000, 1520899800000, 1520900100000, 1520900400000]
            )
        })

    })

    it("plans a cluster job with namespacing", async () => {
        // when
        const plan = await repo.plan("1->2")
        // then
        expect(plan.name).toEqual("1->2")
        expect(plan.deployments).toHaveLength(1)

        const deploymentPlan = plan.deployments[0]

        // deploy into cluster2
        expect(deploymentPlan.group.cluster).toBe("cluster2")
        expect(deploymentPlan.group.namespace).toEqual("service1")

        // service1 gets from tag1 to tag2
        expect(deploymentPlan.image.tag).toBe("tag2")
        expect(deploymentPlan.deployment.name).toBe("service1")
        expect(deploymentPlan.deployment.image.tag).toBe("tag1")
    })

    it("plans an image job", async () => {
        // when
        const plan = await repo.plan("i->1")

        // then
        expect(plan.name).toEqual("i->1")
        expect(plan.deployments).toHaveLength(1)

        const deploymentPlan = plan.deployments[0]

        // deploy into cluster1
        expect(deploymentPlan.group.cluster).toBe("cluster1")
        expect(deploymentPlan.group.namespace).toBeUndefined()

        // service1 gets from tag2 to tag3
        expect(deploymentPlan.image.tag).toBe("tag3")
        expect(deploymentPlan.deployment.name).toBe("service1")
        expect(deploymentPlan.deployment.image.tag).toBe("tag2")
    })

    it("applies plans", async () => {
        // when
        await repo.planAndApply("1->2")

        // then
        expect(updateDeploymentMock).toHaveBeenCalledWith({
            deployment: {
                image: { name: "image1", tag: "tag1" },
                name: "service1"
            },
            image: { name: "image1", tag: "tag2" },
            group: { cluster: "cluster2", namespace: "service1" }
        })
    })

    it("returns scheduled cron jobs", async () => {
        // when
        const crons = await repo.schedules("i->1")

        // then
        expect(crons.isRunning).toBeFalsy()
        expect(crons.isStarted).toBeFalsy()
        expect(crons.name).toEqual("i->1")
        expect(crons.nextRuns).toHaveLength(5)
    })

    it("starts scheduled cron jobs", async () => {
        // when
        await repo.start()

        // then
        const crons = await repo.schedules("i->1")
        expect(crons.isStarted).toBeTruthy()
    })
})
