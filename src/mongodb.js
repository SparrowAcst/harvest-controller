const mongo = require('mongodb').MongoClient



const normalize = str => {
	const d = str.split(".")
	return {
		dbName: d[0],
		collectionName: d[1]
	}
}	


const drop = async options => {
	let client

	try {
		
		const conf = normalize(options.collection)
		client = await mongo.connect(options.db.url, {
		    useNewUrlParser: true,
		    useUnifiedTopology: true
		})
	
		await client
				.db(conf.dbName)
				.collection(conf.collectionName)
				.drop()
	
	} catch (e) {

		console.log(e.toString())
		throw new Error(e)

	} finally {
	
		if(client) client.close()
	
	}    
} 

const listCollections = async options => {
	let client
	try {
		
		const conf = normalize(options.db.name)
		
		client = await mongo.connect(options.db.url, {
		    useNewUrlParser: true,
		    useUnifiedTopology: true
		})
		
		const res =  await client
	    				.db(conf.dbName)
	    				.listCollections()
	    				.toArray()
		return res

	} catch (e) {
		
		console.log(e.toString())
		throw new Error(e)
	
	} finally {
	
		if(client) client.close()
	
	}

}



const aggregate = async options => {

	options.retry = (options.retry || 0) + 1
	
	let client
	
	try {

		const conf = normalize(options.collection)
		const pipeline = options.pipeline || []
	    
		client = await mongo.connect(options.db.url, {
		    useNewUrlParser: true,
		    useUnifiedTopology: true
		})
		
		const res =  await client
	    				.db(conf.dbName)
	    				.collection(conf.collectionName)
	    				.aggregate(pipeline.concat([{$project:{_id:0}}]))
			   			.toArray()
		return res

	} catch (e) {
		
		console.log(e.toString())

		if(options.retry == 1){
			console.log(`Retry aggregate operation`)
			if(client) client.close()
			const res = await aggregate(options)	
			return res
		} else {
			throw new Error(e)	
		}
	
	} finally {
	
		if(client) client.close()
	
	}   
}

const aggregate_raw = async options => {
	let client
	try {
		
		const conf = normalize(options.collection)
		const pipeline = options.pipeline || []
	    
		client = await mongo.connect(options.db.url, {
		    useNewUrlParser: true,
		    useUnifiedTopology: true
		})
		
		const res =  await client
	    				.db(conf.dbName)
	    				.collection(conf.collectionName)
	    				.aggregate(pipeline)
			   			.toArray()
		return res

	} catch (e) {
		
		console.log(e.toString())
		throw new Error(e+JSON.stringify(options, null, " "))
	
	} finally {
	
		if(client) client.close()
	
	}   
}

const removeAll = async options => {
	let client

	try {
		
		const conf = normalize(options.collection)
		client = await mongo.connect(options.db.url, {
		    useNewUrlParser: true,
		    useUnifiedTopology: true
		})
	
		await client
				.db(conf.dbName)
				.collection(conf.collectionName)
				.deleteMany({})
	
	} catch (e) {

		console.log(e.toString())
		throw new Error(e)

	} finally {
	
		if(client) client.close()
	
	}    
}


const deleteMany = async options => {
	let client

	try {
		
		const conf = normalize(options.collection)
		client = await mongo.connect(options.db.url, {
		    useNewUrlParser: true,
		    useUnifiedTopology: true
		})
	
		await client
				.db(conf.dbName)
				.collection(conf.collectionName)
				.deleteMany(options.filter)
	
	} catch (e) {
		console.log(e.toString())
		throw new Error(e)

	} finally {
	
		if(client) client.close()
	
	}    
} 

const insertAll = async options => {
	let client
	try {

		let conf = normalize(options.collection)
		
		client = await mongo.connect(options.db.url, {
		    useNewUrlParser: true,
		    useUnifiedTopology: true
		})
		
		await client
				.db(conf.dbName)
				.collection(conf.collectionName)
				.insertMany(options.data)
	
	} catch (e) {
	
		console.log(e.toString())
		throw new Error(e)

	} finally {
	
		if(client) client.close()
	
	}	
}

const bulkWrite = async options => {
	let client
	try {
		
		const conf = normalize(options.collection)
		client = await mongo.connect(options.db.url, {
		    useNewUrlParser: true,
		    useUnifiedTopology: true
		})

		await client
				.db(conf.dbName)
				.collection(conf.collectionName)
				.bulkWrite(options.commands)

	} catch (e) {
	
		console.log(e.toString())
		throw new Error(e)

	} finally {
	
		if(client) client.close()
	
	}	
}

const replaceOne = async options => {
	let client
	try {

		const conf = normalize(options.collection)
		client = await mongo.connect(options.db.url, {
		    useNewUrlParser: true,
		    useUnifiedTopology: true
		})

	    await client
	    		.db(conf.dbName)
	    		.collection(conf.collectionName)
	    		.replaceOne(options.filter, options.data, {upsert: true})

	} catch (e) {
	
		console.log(e.toString())
		throw new Error(e)

	} finally {
	
		if(client) client.close()
	
	}    
}

const updateOne = async options => {
	let client
	try {
	
		let conf = normalize(options.collection)
		client = await mongo.connect(options.db.url, {
		    useNewUrlParser: true,
		    useUnifiedTopology: true
		})
	
	    await client
	    		.db(conf.dbName)
	    		.collection(conf.collectionName)
	    		.updateOne(options.filter, { $set:options.data }, { upsert: true })
	
	} catch (e) {
	
		console.log(e.toString())
		throw new Error(e)

	} finally {
	
		if(client) client.close()
	
	}    
}

const deleteOne = async options => {
	let client
	try {
	
		let conf = normalize(options.collection)
		client = await mongo.connect(options.db.url, {
		    useNewUrlParser: true,
		    useUnifiedTopology: true
		})
	
	    await client
	    		.db(conf.dbName)
	    		.collection(conf.collectionName)
	    		.deleteOne(options.filter)
	
	} catch (e) {
	
		console.log(e.toString())
		throw new Error(e)

	} finally {
	
		if(client) client.close()
	
	}    
}


const updateMany = async options => {
	let client
	try {
	
		let conf = normalize(options.collection)
		client = await mongo.connect(options.db.url, {
		    useNewUrlParser: true,
		    useUnifiedTopology: true
		})
	
	    await client
	    		.db(conf.dbName)
	    		.collection(conf.collectionName)
	    		.updateMany(options.filter, { $set:options.data }, { upsert: true })
	
	} catch (e) {
	
		console.log(e.toString())
		throw new Error(e)

	} finally {
	
		if(client) client.close()
	
	}    
}



module.exports =  {
	aggregate,
	removeAll,
	insertAll,
	replaceOne,
	updateOne,
	deleteOne,
	bulkWrite,
	listCollections, 
	drop,
	aggregate_raw,
	deleteMany,
	updateMany	
}