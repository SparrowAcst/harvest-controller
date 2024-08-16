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

let { flattenDeep, uniqBy, sortBy, first, min, max, isUndefined } = require("lodash")
let { avg, sum } = require("../../utils/stat")


/////////////////////////////////////////////////////////////////////////////////

const getSegmentArray = polygons =>
    flattenDeep(
        polygons
        .map(p => Array.from(p.edges)
            .map(e => e.shape)
        )
    )

const getPointArray = polygons =>
    uniqBy(
        flattenDeep(
            getSegmentArray(polygons)
            .map(s => s.vertices)
        ),
        p => p.x.toString() + p.y.toString()
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
    p => vector(center, point(center.x + 100, center.y)).angleTo(vector(center, p))

)

const getIntersection = polygons => {

    let intersection = polygons[0]
    for (let p of polygons) {
        try {
            intersection = BooleanOperations.intersect(intersection, p)
            intersection = simplify(intersection)
        } catch (e) {
            console.log("------------------------------------- ERROR I", e.toString())
            console.log("p", getPointArray([p]))
            console.log("intersection", getPointArray([intersection]))
        }
        if (!intersection) return
    }
    return intersection

}

const getUnion = polygons => {

    let union = polygons[0]
    for (let p of polygons) {
        try {
            union = BooleanOperations.unify(union, p)
            union = simplify(union)
        } catch (e) {
            console.log("--------------------------------------- ERROR U", e.toString())
            console.log("p", getPointArray([p]))
            console.log("union", getPointArray([union]))
        }
        if (!union) return
    }
    return union
}


const fit = polygons => {

    let centroids = polygons.map(p => centroid(p))
    return polygons.map((p, i) => p.translate(vector(-centroids[i].x, -centroids[i].y)))

}


const merge = polygons => {

    let centroids = polygons.map(p => centroid(p))

    let c = point(avg(centroids.map(c => c.x)), avg(centroids.map(c => c.y))) //centroid(intersection)
    let points = getPointArray(polygons)
    points = sortCW(points, c)
    let segments = points.map(p => segment(c, p))
    let rays = segments.map(s => ray(c, s.tangentInStart().rotate90CCW()))

    let mergedPoints = flattenDeep(rays.map(r => {
        let p = flattenDeep(polygons.map(p => r.intersect(p)))
        return point([
            avg(p.map(d => d.x)),
            avg(p.map(d => d.y)),
        ])
    }))

    return polygon(mergedPoints)

}

const simplify = (p, factor) => {

    let c = centroid(p)
    let points = getPointArray([p])
    points = sortCW(points, c)

    let currentPolygon = polygon(points)

    factor = factor || 0.001
    let f = true
    while (f) {

        let points = getPointArray([currentPolygon])
        let area = currentPolygon.area()
        let min = Infinity
        let minPolygon

        for (let i = 0; i < points.length; i++) {
            let np = points.map(point => point.clone())
            np.splice(i, 1)
            let testPolygon = polygon(np)
            let m = 1 - testPolygon.area() / area
            m = (m < 0) ? 0 : m
            if (m < min) {
                min = m
                minPolygon = testPolygon.clone()
            }
        }
        if (min < factor) {
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
        x: 1 / (boundaryBox.x.max - boundaryBox.x.min),
        y: 1 / (boundaryBox.y.max - boundaryBox.y.min)
    }
}

const getNormalizedTranslateVector = polygons => {

    let boundaryBox = getBoundaryBox(polygons)
    return vector(-boundaryBox.x.min, -boundaryBox.y.min)

}

const getPatternForPolygons = (polygons, factor) => {

    factor = factor || 0.001
    polygons = fit(polygons)
    let pattern = simplify(merge(polygons), factor)

    let a = pattern.area()
    let metric = Math.sqrt(sum(polygons.map(p => (p.area() - a) * (p.area() - a))) / polygons.length / (polygons.length - 1)) / a

    let consistency = polygons.map(p => getIntersection([pattern, p]).area() / getUnion([pattern, p]).area())
    consistency = avg(consistency)



    return {
        polygons,
        patterns: [pattern],
        metric: Number.parseFloat(metric.toFixed(3)),
        consistency: Number.parseFloat(consistency.toFixed(3)),
    }

}

const getSVG = ({ polygons, patterns, svgOptions }) => {

    svgOptions = svgOptions || {
        polygon: {
            stroke: "black",
            strokeWidth: 0.002,
            fill: "none",
            opacity: 1,
            r: 0.003
        },

        pattern: {
            stroke: "red",
            strokeWidth: 0.015,
            fill: "#ffff9920",
            opacity: 1,
            r: 0.0155
        }
    }

    if (polygons) {
        polygons = polygons.map(p => p.clone())
    } else {
        if (patterns) {
            polygons = patterns
        } else {
            return `<svg viewBox = "0 0 1 1" xmlns="http://www.w3.org/2000/svg"></svg>`
        }
    }

    if (patterns) {
        patterns = patterns.map(p => p.clone())
    }

    let scale = getNormalizedScale(polygons)

    polygons = polygons.map(p => p
        .scale(scale.x, scale.y)
        .transform(matrix(1, 0, 0, -1, 0, 0)))

    if (patterns) {

        patterns = patterns.map(p => p
            .scale(scale.x, scale.y)
            .transform(matrix(1, 0, 0, -1, 0, 0)))

    }

    let translation = getNormalizedTranslateVector(polygons)

    polygons = polygons.map(p => p
        .translate(translation))

    if (patterns) {

        patterns = patterns.map(p => p
            .translate(translation))

    }

    return `
<svg viewBox = "-0.1 -0.1 1.2 1.2" xmlns="http://www.w3.org/2000/svg">
    ${polygons.map(p => p.svg(svgOptions.polygon)).join("\n")}
    ${getPointArray(polygons).map(p => p.svg(svgOptions.polygon)).join("\n")}
    ${(patterns) ? patterns.map(p => p.svg(svgOptions.pattern)).join("\n") : ""}
    ${(patterns) ? getPointArray(patterns).map(p => p.svg(svgOptions.pattern)).join("\n") : ""}

</svg>
`

}

const array2Polygons = a => a.map(d => polygon(d[1].map((x, i) => point([x, d[2][i]]))))

const polygon2Array = polygon => getPointArray([polygon]).map(p => [p.x, p.y])



module.exports = {
    array2Polygons,
    polygon2Array,
    getIntersection,
    getUnion,
    getBoundaryBox,
    getSVG,
    getPatternForPolygons,
    getPointArray,
    getSegmentArray,
    fit,
    merge,
    simplify,
    centroid
}