import { DockerImageProvider } from "../../../src/images/docker/DockerImageProvider"
import axios, { AxiosResponse } from "axios"
import { AsyncResource } from "async_hooks";


describe("DockerImageProvider", () => {

    const provider = new DockerImageProvider("baseUrl")

    it("retrieves images", async () => {
        const images = ["image1", "image2"]
        axios.get = axiosSuccess({ repositories: images })
        expect(provider.images()).resolves.toEqual(images)
        expect(axios.get).toHaveBeenCalledWith("baseUrl/v2/_catalog")
    })

    it("retrieves image versions", async () => {
        const layer = { v1Compatibility: "{\"created\":\"2018-05-29T11:53:39.318928398Z\"}" }
        axios.get = axiosSuccess(
            { name: "image1", tags: ["tag1", "tag2"] },
            { name: "image1", tag: "tag1", history: [layer] },
            { name: "image1", tag: "tag2", history: [layer] }
        )
        const versions = await provider.versions("image1")
        expect(versions).toEqual([
            { image: "image1", tag: "tag1", lastUpdated: new Date(Date.parse("2018-05-29T11:53:39.318Z")) },
            { image: "image1", tag: "tag2", lastUpdated: new Date(Date.parse("2018-05-29T11:53:39.318Z")) }
        ])
        expect(axios.get).toHaveBeenCalledTimes(3)
        expect(axios.get).toHaveBeenCalledWith("baseUrl/v2/image1/tags/list")
        expect(axios.get).toHaveBeenCalledWith("baseUrl/v2/image1/manifests/tag1")
        expect(axios.get).toHaveBeenCalledWith("baseUrl/v2/image1/manifests/tag2")
    })

    it("retrieves last updated of an image version", async () => {
        axios.get = axiosSuccess(
            { name: "image1", tags: ["tag1"] },
            {
                name: "image1", tag: "tag1",
                history: [
                    { v1Compatibility: "{\"created\":\"2018-05-29T11:53:39.318928398Z\"}" },
                    { v1Compatibility: "{\"created\":\"2018-05-05T08:05:40.458179209Z\"}" },
                    { v1Compatibility: "{\"created\":\"2018-05-29T11:53:39.318928398Z\"}" }
                ]
            })
        const versions = await provider.versions("image1")
        expect(versions).toEqual([
            { image: "image1", tag: "tag1", lastUpdated: new Date(Date.parse("2018-05-29T11:53:39.318Z")) },
        ])
        expect(axios.get).toHaveBeenCalledTimes(2)
        expect(axios.get).toHaveBeenCalledWith("baseUrl/v2/image1/tags/list")
        expect(axios.get).toHaveBeenCalledWith("baseUrl/v2/image1/manifests/tag1")
    })
})

function success<T>(data: T): AxiosResponse<T> {
    return {
        config: {},
        data,
        headers: {},
        request: undefined,
        status: 200,
        statusText: "Ok",
    }
}

export function axiosSuccess(...data: object[]): jest.Mock<{}> {
    let mock = jest.fn()
    data.forEach(d => mock.mockReturnValueOnce(Promise.resolve(success(d))))
    return mock
}