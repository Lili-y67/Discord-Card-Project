
const colorCodeChrList =  "0123456789ABCDEF".split('')



const interifyAList = (list) => {
    let intList = []
    for(let elementIndex = 0; elementIndex<list.length; elementIndex++){
        intList.push(parseInt(list[elementIndex]))
    }
    return intList
}

const sortLinkedList = (cardIDListAndFilterValue) => { //renvoie la linkedList trié selon le second élément

    if(cardIDListAndFilterValue.length==0){
        return []
    }


    var sortedLinkedList = [cardIDListAndFilterValue[0]]

    for(var currentElement = 1; currentElement<cardIDListAndFilterValue.length;currentElement++){

        let keepLoop = true
        var currentCheck = 0


        while(keepLoop){

            if(sortedLinkedList[currentCheck][1] <= cardIDListAndFilterValue[currentElement][1]){
                sortedLinkedList.splice(currentCheck, 0, cardIDListAndFilterValue[currentElement])
                keepLoop = false
            }
            if(currentCheck>=sortedLinkedList.length-1){
                sortedLinkedList.splice(currentCheck+1, 0, cardIDListAndFilterValue[currentElement])
                keepLoop = false
            }
            
            currentCheck++
        }

        for(let elementLoop = 0; elementLoop<cardIDListAndFilterValue.length;elementLoop++){
        }
    }

    return sortedLinkedList
}


const isStringAnHexadecimalColorCode = (stringColorCode) => {

    if(stringColorCode.length!=6){
        return false
    }

    for(let chrIndex = 0; chrIndex<stringColorCode.length; chrIndex++){
        if(!colorCodeChrList.includes(stringColorCode[chrIndex])){
            return false
        }
    }

    return true
}




module.exports = {
    interifyAList,
    sortLinkedList,
    isStringAnHexadecimalColorCode
};