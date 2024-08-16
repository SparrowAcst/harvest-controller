let {
    point, 
    segment, 
    polygon, 
    ray, 
    vector, 
    BooleanOperations,
    matrix,
    box
} = require('@flatten-js/core');

let { flattenDeep, uniqBy, sortBy, first, min, max } = require("lodash")
let { avg } = require("../utils/stat")


/////////////////////////////////////////////////////////////////////////////////

const getSegmentArray = polygons => 
    flattenDeep(
        polygons
            .map( p => Array.from(p.edges)
                        .map( e => e.shape)
            )
    )

const getPointArray = polygons => 
    uniqBy(
        flattenDeep(
            getSegmentArray(polygons)
                .map( s => s.vertices )
        ),       
        p => p.x.toString()+p.y.toString()
    )

const centroid = polygon => {
    let points = getPointArray([polygon])
    let res = {
        x: avg(points.map(p => p.x)),
        y: avg(points.map(p => p.y))
    }

    return point(res.x, res.y)
}

const sortCW = (points, center) => sortBy(

    points,
    p => vector(center, point(center.x+100, center.y)).angleTo(vector(center, p))

)


const getIntersection = polygons => {
    
    let intersection = polygons[0]
    for( let p of polygons){
        intersection = BooleanOperations.intersect(intersection, p)
        if(!intersection) return
    }
    return intersection

}

const getUnion = polygons => {
    
    let union = polygons[0]
    let i = 0
    for( let p of polygons){
        i++
        try {
            union = BooleanOperations.unify(union, p)
        } catch(e) {
            console.log(i, e.toString())
        }
        if(!union) return
    }
    return union
}


const fit = polygons => {

    let centroids = polygons.map( p => centroid(p))
    return polygons.map( (p, i) => p.translate(vector(-centroids[i].x,-centroids[i].y)))
    
}


const merge = polygons => {

    let intersection = getIntersection(polygons)
    if(!intersection) return

    let c = centroid(intersection)
    let points = getPointArray(polygons)
    points = sortCW(points, c)
    let segments = points.map( p => segment(c,p))
    let rays = segments.map( s => ray(c, s.tangentInStart().rotate90CCW()))

    let mergedPoints = flattenDeep (rays.map( r => {
        let p = flattenDeep( polygons.map( p => r.intersect(p)) )
        return point([
            avg(p.map( d => d.x)),
            avg(p.map( d => d.y)),
        ])
    }))

    return polygon(mergedPoints)

}

const simplify = (p, factor) => {
    
    let currentPolygon = p
    let  f = true

    while(f){
        
        let points = getPointArray([currentPolygon])
        let area = currentPolygon.area()
        let min = Infinity
        let minPolygon  
        
        for(let i = 0; i < points.length; i++){
            let np = points.map(point => point.clone())
            np.splice(i, 1)
            let testPolygon = polygon(np)
            let m = 1 - testPolygon.area()/area
            m = (m < 0) ? 0 : m
            if(m < min){
                min = m
                minPolygon = testPolygon.clone() 
            }
        }
        if( min < factor){
            f = true
            currentPolygon = minPolygon.clone() 
        } else {
            f = false
        }
    }
    
    return currentPolygon

}


const getBoundaryBox = polygons => {
    
    points = getPointArray(polygons)
    let x = points.map(p => p.x)
    let y = points.map(p => p.y)

    return {
        x: {
            min: min(x),
            max: max(x)
        },
        y: {
            min: min(y),
            max: max(y)
        }
    }

}

const getNormalizedScale = polygons => {

    let boundaryBox = getBoundaryBox(polygons)
    return {
        x: 1/(boundaryBox.x.max-boundaryBox.x.min),
        y: 1/(boundaryBox.y.max-boundaryBox.y.min)
    }
}

const getNormalizedTranslateVector = polygons => {

    let boundaryBox = getBoundaryBox(polygons)
    return vector(-boundaryBox.x.min,-boundaryBox.y.min)
    
}

const getPatternForPolygons = (poligons, factor) => {
    factor = factor || 0.001
    polygons = fit(polygons)
    return {
        polygons,
        patterns: [simplify(merge(polygons), factor)]
    }   

}

const getSVG = ( {polygons, patterns, svgOptions } ) => {

    svgOptions = svgOptions || {
        polygon:{
            stroke: "black",
            strokeWidth: 0.001,
            fill: "none",
            opacity: 1
        },

        pattern:{
            stroke: "red",
            strokeWidth: 0.01,
            fill: "none",
            opacity: 1
        }
    }   
    
    if(polygons){
        polygons = polygons.map( p => p.clone())
    } else {
        if(patterns){
            polygons = patterns
        } else {
            return `<svg viewBox = "0 0 1 1" xmlns="http://www.w3.org/2000/svg"></svg>`
        }
    }

    if(patterns){
        patterns = patterns.map( p => p.clone())
    }   

    let scale = getNormalizedScale(polygons)

    polygons = polygons.map( p => p
        .scale(scale.x, scale.y)
        .transform(matrix(1,0,0,-1,0,0)))

    if(patterns){

        patterns = patterns.map( p => p
        .scale(scale.x, scale.y)
        .transform(matrix(1,0,0,-1,0,0)))
    
    }
    
    let translation = getNormalizedTranslateVector(polygons)

    polygons = polygons.map( p => p
        .translate(translation))

    if(patterns){

        patterns = patterns.map( p => p
        .translate(translation))
    
    }

    return `
<svg viewBox = "0 0 1 1" xmlns="http://www.w3.org/2000/svg">
    ${polygons.map(p => p.svg(svgOptions.polygon)).join("\n")}
    ${(patterns) ? patterns.map(p => p.svg(svgOptions.pattern)).join("\n") : ""}
<svg>
`

}


const getConsistency = polygons => {
    
    let fitted = fit(polygons)
    let u = getUnion(fitted)
    let i = getIntersection(fitted)
    return (u) ? (((i) ? i.area() : 0) / u.area()) : Number.NaN
    
}


const array2Polygons = a => a.map( d => polygon(d[1].map( (x, i) => point([x, d[2][i]]) )))

const polygon2Array = polygon => getPointArray([polygon]).map( p => [p.x, p.y])



module.exports = {
    array2Polygons,
    polygon2Array,
    getIntersection,
    getUnion,
    getBoundaryBox,
    getConsistency,
    getSVG,
    getPatternForPolygons,
    getPointArray,
    getSegmentArray,
    fit,
    merge,
    simplify,
    centroid
}