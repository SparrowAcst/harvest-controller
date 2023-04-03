const app = require("./app.json")
const pages = app.pages.map( p => p.replace(/\/\//g), "")

pages.forEach( p => {
	console.log(JSON.stringify(JSON.parse(p), null, " "))
	console.log("-----------------------------------------------------------------------")
})
