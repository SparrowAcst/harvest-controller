
const nodeCache = require("node-cache")
const md5 = require("js-md5")
const { isObject } = require("lodash")

const CACHE = new nodeCache({stdTTL: 2*60*60, checkperiod: 5*60 }) // Time to Life = 2*60*60 = 2 hours, Check Period: 5*60 = 5 min

const hash = data => (isObject(data)) ? md5(JSON.stringify([
    data.dataId,
    data.versionId
])) : data

const getRequest = data => {
    
    let existedRequest = CACHE.get(hash(data))
        
        if(existedRequest){
            if(existedRequest.user == data.user){
                if(existedRequest.responseData){
                    let index = findIndex(existedRequest.requestData.data, d => d.user == data.user)
                    if(index > -1){
                        existedRequest.requestData.data[index].segmentation = responseData.segmentation
                    }
                }
                existedRequest.updatedAt = new Date()
                CACHE.set(existedRequest.hash, existedRequest)
            }

            return existedRequest
        }
}



module.exports = {
    
    keys: () => CACHE.keys(),
    
    getStats: () => CACHE.getStats(),

    get: data => CACHE.get(hash(data)),

    del: data => CACHE.del(hash(data)),
    
    set: (hashData, data) => {
        data = data || hashData
        data.hash = hash(data)
        CACHE.set(hash(data), data)
        return data
    },
    
    getRequest    

}