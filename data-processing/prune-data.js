const { from } = require('rxjs');
const { groupBy, mergeMap, last } = require('rxjs/operators');
function prune(data, timeinMs) {
    const data$ = from(data)
        .pipe(
            groupBy(item => Math.floor(item.timestamp / timeinMs)),
            mergeMap(group$ => group$.pipe(last()))
        )
    return data$
}

module.exports = prune;