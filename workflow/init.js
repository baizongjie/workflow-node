const fs = require('fs');
const log = require('../logger').getLogger('workfow_init');
const templateDir = '../flow-template';
const files = fs.readdirSync(`${__dirname}/${templateDir}`);

const flowTemplates = {};
const flowLatestVersion = {};

function checkAndUpdateLatestVersion(flowCode, version){
    if(!flowLatestVersion[flowCode]){
        flowLatestVersion[flowCode] = version;
    }else{
         if(compareVersion(version,flowVersion[flowCode]) > 0){
            flowLatestVersion[flowCode] = version;
         }
    }
}

function compareVersion(version1, version2){
    let v1 = version1.split('.');
    let v2 = version2.split('.');
    for(let i=0; i<v1.length; i++){
        if(!v2[i]){
            return 1;
        }else if(v1[i] > v2[i]){
            return 1;
        }else if(v1[i] < v2[i]){
            return -1;
        }
    }
    return 0;
}

files.map( file => {
    const {flowName, flowCode, version, flowDetail, subFlow} = JSON.parse(fs.readFileSync(`${__dirname}/${templateDir}/${file}`,'utf-8'));
    // 需补充 检查模板格式和有效性的逻辑

    checkAndUpdateLatestVersion(flowCode, version);

    const tmpNodes = {};
    flowDetail.map( node => {
        tmpNodes[node.nodeCode] = {
            ...node,
        };
    })
    // for (let node of Object.values(tmpNodes)){
    //     node.nextNode = new Array();
    //     node.next.map( nodeCode => {
    //         if(nodeCode === 'end'){
    //             node.nextNode.push({
    //                 nodeType:'end'
    //             })
    //         }else{
    //             node.nextNode.push(tmpNodes[nodeCode]);
    //         }
    //     })
    // }

    flowTemplates[`${flowCode}@${version}`] = {
        flowCode,
        flowName,
        version,
        firstNode: () => tmpNodes[flowDetail[0].nodeCode],
        ...tmpNodes,

    }

    log.info(`加载流程模板(${flowCode}@${version})完毕`);
});

Object.keys(flowLatestVersion).map( flowCode => {
    flowTemplates[flowCode] = flowTemplates[`${flowCode}@${flowLatestVersion[flowCode]}`];
    flowTemplates[`${flowCode}@latest`] = flowTemplates[`${flowCode}@${flowLatestVersion[flowCode]}`];
})

module.exports = flowTemplates;