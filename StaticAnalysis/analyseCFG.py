import networkx as nx
from networkx.readwrite import json_graph
import pygraphviz
import difflib
import re
import json
import sys
import os
import hashlib
import time

def main ():
    start = time.time()
    print "\nstart "+sys.argv[2]

    callGraphDir = sys.argv[1]+"/graphs/callGraph"
    interGraphDir = sys.argv[1]+"/interGraphs"
    targetGraphDir = sys.argv[1]+"/graphs/"+sys.argv[2]
    pathToFileA = sys.argv[3]
    pathToFileB = sys.argv[4]
    fileId = sys.argv[2]
    fileId = "_"+hashlib.md5(fileId.encode()).hexdigest()

    ### read files ###
    # replace id of node
    # BB_entry11[...];
    # BB139 [...]
    # BB_entry11 -> BB139 [...]
    with open(targetGraphDir+"/locMap_A.json") as f:
        locMapA = json.load(f)
    with open(targetGraphDir+"/locMap_B.json") as f:
        locMapB = json.load(f)
    for obj in locMapA + locMapB:
        obj['blockId'] = obj['blockId']+fileId

    with open(targetGraphDir+"/flowgraphs_A", 'r') as f:
        dotA = f.readlines()
    newLines = []
    for l in dotA:
        s = re.split('(BB\d+|BB_entry\d+)', l)
        l = ""
        for i in range(0, len(s)):
            l += s[i]
            if i % 2 == 1:
                l += fileId
        newLines.append(l)
    dotA = newLines
    with open(targetGraphDir+"/flowgraphs_replaced_A", 'w') as f:
        f.writelines(dotA)
    CFGA = nx.drawing.nx_agraph.read_dot(targetGraphDir+"/flowgraphs_replaced_A")

    with open(targetGraphDir+"/flowgraphs_B", 'r') as f:
        dotB = f.readlines()
    newLines = []
    for l in dotB:
        s = re.split('(BB\d+|BB_entry\d+)', l)
        l = ""
        for i in range(0, len(s)):
            l += s[i]
            if i % 2 == 1:
                l += fileId
        newLines.append(l)
    dotB = newLines
    with open(targetGraphDir+"/flowgraphs_replaced_B", 'w') as f:
        f.writelines(dotB)
    CFGB = nx.drawing.nx_agraph.read_dot(targetGraphDir+"/flowgraphs_replaced_B")

    print "create graphs " + str(time.time()-start)

    with open(callGraphDir+"/callgraph_A.json") as f:
        CGEdgesA = json.load(f)
    with open(callGraphDir+"/callgraph_B.json") as f:
        CGEdgesB = json.load(f)

    # mark file of node
    for data in CFGA.nodes.values():
        data['file'] = pathToFileA
    for data in CFGB.nodes.values():
        data['file'] = pathToFileB

    ### compute difference ###
    diffMapA = {'added': [], 'changed': []}
    diffMapB = {'added': [], 'changed': []}
    summerizeDiff(dotA, dotB, diffMapA, diffMapB, fileId)
    # print diffMapA

    # mark diffent node
    markDiffNode(CFGA, CFGB, diffMapA, diffMapB)

    ### calcurate affected node ###
    # map location to node
    for id, data in CFGA.nodes.items():
        data['locList'] = []
        for obj in locMapA:
            if obj['blockId'] == id:
                data['locList'].append(obj['loc'])
    for id, data in CFGB.nodes.items():
        data['locList'] = []
        for obj in locMapB:
            if obj['blockId'] == id:
                data['locList'].append(obj['loc'])

    # mark read and write variable and call block
    for data in CFGA.nodes.values() + CFGB.nodes.values():
        data['read'] = readVars(data) #{name: x, loc: [0,0,0,0]}
        data['write'] = writeVar(data) #{name: x, loc: [0,0,0,0]}
        data['cond'] = condLoc(data) #[0,0,0,0] or null
        if 'label' in data.keys():
            if re.match('{\d+: call', data['label']):
                data['call'] = True

    # delete gray edge
    for id, data in CFGA.edges.items():
        if 'color' in data and data['color'] == 'gray':
            CFGA.remove_edge(id[0], id[1])
    for id, data in CFGB.edges.items():
        if 'color' in data and data['color'] == 'gray':
            CFGB.remove_edge(id[0], id[1])

    ### get subGraph of each function
    funcListA = {}
    entriesA = filter(lambda n: 'BB_entry' in n, CFGA.nodes)
    for en in entriesA:
        clusterId = en[8:]
        name = getFuncName(clusterId, fileId, dotA)
        CFGA.nodes[en]['funcName'] = name
        subGraph = nx.Graph.subgraph(CFGA, filter(lambda n: nx.has_path(CFGA, en, n), CFGA.nodes))
        for data in subGraph.nodes.values():
            data["entry"] = en
        markAffected(subGraph, diffMapA, en, fileId)
        cdg = createCDG(subGraph, clusterId, name, pathToFileA)
        funcListA[clusterId] = {"funcName": name, "subGraph": subGraph, "CDG": cdg}
    funcListB = {}
    entriesB = filter(lambda n: 'BB_entry' in n, CFGB.nodes)
    for en in entriesB:
        clusterId = en[8:]
        name = getFuncName(clusterId, fileId, dotB)
        CFGB.nodes[en]['funcName'] = name
        subGraph = nx.Graph.subgraph(CFGB, filter(lambda n: nx.has_path(CFGB, en, n), CFGB.nodes))
        for data in subGraph.nodes.values():
            data["entry"] = en
        markAffected(subGraph, diffMapB, en, fileId)
        cdg = createCDG(subGraph, clusterId, name, pathToFileB)
        funcListB[clusterId] = {"funcName": name, "subGraph": subGraph, "CDG": cdg}

    print "mark node information " + str(time.time()-start)

    ### compute distance from each node to each node in ICDG ###
    # create ICFG and ICDG with callgraph
    # not correspond to function passed as arguments
    ICFGA = nx.DiGraph()
    if os.path.exists(interGraphDir+'/ICFG_A.json'):
        with open(interGraphDir+'/ICFG_A.json') as f:
            ICFGA = json_graph.jit_graph(json.load(f), create_using=nx.DiGraph())
    ICFGB = nx.DiGraph()
    if os.path.exists(interGraphDir+'/ICFG_B.json'):
        with open(interGraphDir+'/ICFG_B.json') as f:
            ICFGB = json_graph.jit_graph(json.load(f), create_using=nx.DiGraph())
    ICDGA = nx.DiGraph()
    if os.path.exists(interGraphDir+'/ICDG_A.json'):
        with open(interGraphDir+'/ICDG_A.json') as f:
            ICDGA = json_graph.jit_graph(json.load(f), create_using=nx.DiGraph())
    ICDGB = nx.DiGraph()
    if os.path.exists(interGraphDir+'/ICDG_B.json'):
        with open(interGraphDir+'/ICDG_B.json') as f:
            ICDGB = json_graph.jit_graph(json.load(f), create_using=nx.DiGraph())
    updateICFGandICDG(ICFGA, ICDGA, funcListA, CGEdgesA, pathToFileA)
    updateICFGandICDG(ICFGB, ICDGB, funcListB, CGEdgesB, pathToFileB)

    # map next node in icfg to node
    for id, data in ICDGA.nodes.items():
        data['next'] = list(ICFGA.succ[id])
    for id, data in ICDGB.nodes.items():
        data['next'] = list(ICFGB.succ[id])

    with open(interGraphDir+'/ICFG_A.json', 'w') as f:
        f.write(json_graph.jit_data(ICFGA, 2))
    with open(interGraphDir+'/ICFG_B.json', 'w') as f:
        f.write(json_graph.jit_data(ICFGB, 2))
    with open(interGraphDir+'/ICDG_A.json', 'w') as f:
        f.write(json_graph.jit_data(ICDGA, 2))
    with open(interGraphDir+'/ICDG_B.json', 'w') as f:
        f.write(json_graph.jit_data(ICDGB, 2))
    with open(interGraphDir+'/nodeMap_A.json', 'w') as f:
        json.dump(dict(ICDGA.nodes(data=True)), f, indent=2)
    with open(interGraphDir+'/nodeMap_B.json', 'w') as f:
        json.dump(dict(ICDGB.nodes(data=True)), f, indent=2)
    edgeListA = map(lambda x: {"from": x[0], "to": x[1], "data": x[2]}, ICDGA.edges(data=True))
    edgeListB = map(lambda x: {"from": x[0], "to": x[1], "data": x[2]}, ICDGB.edges(data=True))
    with open(interGraphDir+'/edgeList_A.json', 'w') as f:
        json.dump(edgeListA, f, indent=2)
    with open(interGraphDir+'/edgeList_B.json', 'w') as f:
        json.dump(edgeListB, f, indent=2)

    print "create icfg and icdg " + str(time.time()-start)

    # lenMapA = {}
    # for n1 in ICDGA.nodes:
    #     lenMapA[n1] = {}
    #     for n2 in ICDGA.nodes:
    #         if (nx.has_path(ICDGA, n1, n2)):
    #             lenMapA[n1][n2] = nx.dijkstra_path_length(ICDGA, n1, n2)
    #         else:
    #             lenMapA[n1][n2] = -1
    # lenMapB = {}
    # for n1 in ICDGB.nodes:
    #     lenMapB[n1] = {}
    #     for n2 in ICDGB.nodes:
    #         if (nx.has_path(ICDGB, n1, n2)):
    #             lenMapB[n1][n2] = nx.dijkstra_path_length(ICDGB, n1, n2)
    #         else:
    #             lenMapB[n1][n2] = -1
    # with open(interGraphDir+'/CDGPathLengthMap_A.json', 'w') as f:
    #     json.dump(lenMapA, f, indent=2)
    # with open(interGraphDir+'/CDGPathLengthMap_B.json', 'w') as f:
    #     json.dump(lenMapB, f, indent=2)
    # print "calc distance " + str(time.time()-start)


def markDiffNode(A, B, diffMapA, diffMapB):
    # print A.nodes
    for id, data in A.nodes.items():
        data['mapped'] = diffMapA[id];
        if id in diffMapA['added']:
            data['diff'] = 'added'
        elif id in diffMapA['changed']:
            data['diff'] = 'changed'
        else:
            data['diff'] = 'unchanged'
    for id, data in B.nodes.items():
        data['mapped'] = diffMapB[id];
        if id in diffMapB['added']:
            data['diff'] = 'added'
        elif id in diffMapB['changed']:
            data['diff'] = 'changed'
        else:
            data['diff'] = 'unchanged'


# def createCG(CGEdges):
#     cg = nx.DiGraph()  # call graph
#     for edge in CGEdges:
#         s = edge['source']
#         t = edge['target']
#         if s['label'] not in cg.nodes:
#             cg.add_node(s['label'], file=s['file'])
#         if t['label'] not in cg.nodes:
#             cg.add_node(t['label'], file=t['file'])
#         loc = "@"+str(s['start']['row'])+":"+str(s['start']['column'])+"-"+str(s['end']['row'])+":"+str(s['end']['column'])
#         cg.add_edge(s['label'], t['label'], loc=loc)
#     return cg


def updateICFGandICDG(icfg, icdg, funcList, CGEdges, pathToFile):
    # Is edge from entry to exit is necessary????
    # Is edge weight correct????

    # print funcList

    for clusterId, obj in funcList.items():
        subGraph = obj['subGraph']
        icfg.add_nodes_from(subGraph.nodes(data=True))
        edges = map(lambda x: (x[0], x[1], 1), subGraph.edges)
        icfg.add_weighted_edges_from(edges)
        lasts = filter(lambda x: len(list(subGraph.succ[x])) == 0, subGraph.nodes)
        ex = 'BB_exit'+clusterId
        icfg.add_node(ex, shape="record", funcName=obj['funcName'], file=pathToFile, label="")
        for l in lasts:
            icfg.add_edge(l, ex, weight=0)

    for clusterId, obj in funcList.items():
        cdg = obj['CDG']
        icdg.add_nodes_from(cdg.nodes(data=True))
        edges = map(lambda x: (x[0], x[1], 1), cdg.edges)
        icdg.add_weighted_edges_from(edges)

    for edge in CGEdges:
        s = edge['source']
        t = edge['target']
        if not (s['file'] == pathToFile or t['file'] == pathToFile):
            continue
        # print s
        # print t
        sourceLoc = [s['start']['row'], s['start']['column'], s['end']['row'], s['end']['column']]
        for id, data in icfg.nodes.items():
            if 'call' in data and data['file'] == s['file']:
                match = False
                for loc in data['locList']:
                    if sourceLoc[0]==loc[0] and sourceLoc[1]+1==loc[1] and sourceLoc[2]==loc[2] and sourceLoc[3]+1==loc[3]:
                        match = True
                        break
                if match:
                    if t['label'] != 'anon': # not callback function
                        (entry, exit) = getFuncEntryExit(icfg, t['label'], t['file'])
                        if not (entry is None or exit is None):
                            icfg.add_edge(id, entry, weight=0)
                            icfg.add_edge(exit, id, weight=0)
                            icdg.add_edge(id, entry, weight=0)
                            icdg.add_edge(exit, id, weight=0)


def getFuncEntryExit(icfg, funcName, file):
    en = ex = funcName2 = None
    for id, data in icfg.nodes.items():
        if 'file' in data and data['file'] == file:
            # if id.startswith("BB_entry"):
            #     print "entry"
            #     print data['funcName']
            #     print funcName
            if id.startswith("BB_entry") and data['funcName'].startswith(funcName):
                en = id
                funcName2 = data['funcName']
                break
            if 'funcName' in data and data['funcName'] == '<main>' and funcName == 'global':
                en = id
                funcName2 = data['funcName']
                break
    for id, data in icfg.nodes.items():
        if 'file' in data and data['file'] == file:
            # if id.startswith("BB_exit"):
            #     print "exit"
            #     print data['funcName']
            #     print funcName
            if id.startswith("BB_exit") and data['funcName'] == funcName2:
                ex = id
                break
    return (en, ex)


def getFuncExit(icfg, funcName, file):
    for id, data in icfg.nodes.items():
        if data['file'] == file:
            if id.startswith("BB_exit"):
                print "exit"
                print data['funcName']
                print funcName
            if id.startswith("BB_exit") and data['funcName'] == funcName:
                return id


def getFuncName(clusterId, fileId, dot):
    ### This is a part of dot graph
    # subgraph cluster0 {
    # label="<main> function()\\n../ExpoSEtmp/targetA.js";\n
    # label="function flowTest(lo,hi)\\n../ExpoSEtmp/targetA.js:3:1\\nouter: <main>";\n
        # otherwise
        # e.g. "function()\nHOST(string-replace-model.js):1:1"
    for i in range(0, len(dot)):
        if dot[i].startswith("subgraph cluster" + clusterId[0:-len(fileId)] + " {"):
            if dot[i+1].startswith('label="<main>'):
                return "<main>"
            elif dot[i+1].startswith('label="function '):
                return dot[i+1][16:-1].split('\\nouter')[0]
            else:
                return dot[i+1][7:-1]
    return ""


def condLoc(block):
    if not 'label' in block:
        return None
    nodes = block['label'][1:-1].split('|')
    nodes = map(lambda s: re.sub('\d+: ', '', s), nodes)
    for n, loc in zip(nodes, block['locList']):
        if n.split('[')[0] == 'if':
            return loc

def readVars(block):
    if not 'label' in block:
        return []
    variables = []
    nodes = block['label'][1:-1].split('|')
    nodes = map(lambda s: re.sub('\d+: ', '', s), nodes)
    for n, loc in zip(nodes, block['locList']):
        if n.split('[')[0] == 'read-variable':
            name = n.split('[')[1].split(',')[0][1:-1]
            variables.append({'name': name, 'loc': loc})
        if n.split('[')[0] == 'read-property':
            variables.append({'name': "obj", 'loc': loc})
    return variables


def writeVar(block):
    if not 'label' in block:
        return ''
    variables = []
    nodes = block['label'][1:-1].split('|')
    nodes = map(lambda s: re.sub('\d+: ', '', s), nodes)
    for n, loc in zip(nodes, block['locList']):
        if n.split('[')[0] == 'write-variable':
            name = n.split("'")[-2]
            variables.append({'name': name, 'loc': loc})
        if n.split('[')[0] == 'write-property':
            variables.append({'name': "obj", 'loc': loc})
    return variables

def markAffected(subGraph, diffMap, entry, fileId):
    if (entry in diffMap['added']):
        return # all nodes of subGraph might be added
    affected = calcAffected(subGraph, diffMap['added']+diffMap['changed'], fileId)
    # print affected


def calcAffected(G, init, fileId):
    affected = filter(lambda n: n in G.nodes, init) # calc as intra procedual
    change = True
    while change:
        change = False
        for b_aff in affected:
            for b in G.nodes:
                if nx.has_path(G, b_aff, b):
                    for writeVar in map(lambda x: x['name'], G.nodes[b_aff]['write']):
                        if writeVar in map(lambda x: x['name'], G.nodes[b]['read']):
                            if not b in affected:
                                affected.append(b)
                                G.nodes[b]['affected'] = {'id': b_aff, 'type': 'data'}
                                change = True
                                break
                    if isControlDependent(G, b_aff, b, fileId):
                        if not b in affected:
                            affected.append(b)
                            G.nodes[b]['affected'] = {'id': b_aff, 'type': 'control'}
                            change = True
                if nx.has_path(G, b, b_aff):
                    for writeVar in map(lambda x: x['name'], G.nodes[b]['write']):
                        if writeVar in map(lambda x: x['name'], G.nodes[b_aff]['read']):
                            if not b in affected:
                                affected.append(b)
                                G.nodes[b]['affected'] = {'id': b_aff, 'type': 'backward'}
                                change = True
                                break
    return affected


def isControlDependent(G, b1, b2, fileId):
    nodes = G.nodes[b1]['label'][1:-1].split('|')
    nodes = map(lambda s: re.sub('\d+: ', '', s), nodes)
    for n in nodes:
        if n.split('[')[0] == 'if':
            Tblock = 'BB'+re.search('true-block:\d+', n).group().split(':')[1]+fileId
            Fblock = 'BB'+re.search('false-block:\d+', n).group().split(':')[1]+fileId
            if nx.has_path(G, Tblock, b2) and nx.has_path(G, Fblock, b2):
                return False
            else:
                return True
    return False


def summerizeDiff(dotA, dotB, diffMapA, diffMapB, fileId):
    clusters = {}
    id = None
    for l in dotA[2:-1]:
        if re.match('subgraph cluster\d+ {', l):
            id = l[len('subgraph cluster'):-2]
            clusters[id] = {"A": [], "B": []}
        clusters[id]["A"].append(l)
    for l in dotB[2:-1]:
        if re.match('subgraph cluster\d+ {', l):
            id = l[len('subgraph cluster'):-2]
            if id not in clusters:
                clusters[id] = {"A": [], "B": []}
        clusters[id]["B"].append(l)

    newDotA = dotA[0:2]
    newDotB = dotB[0:2]
    for id in clusters:
        # print id
        # print clusters[id]["A"][1]
        # print clusters[id]["B"][1]
        newDotA += clusters[id]["A"]
        newDotB += clusters[id]["B"]
    newDotA.append(dotA[-1])
    newDotB.append(dotB[-1])
    dotA = newDotA
    dotB = newDotB

    # print ''.join(difflib.ndiff(reshapeDot(dotA, fileId), reshapeDot(dotB, fileId)))
    diff = list(difflib.ndiff(reshapeDot(dotA, fileId), reshapeDot(dotB, fileId)))

    diffA = {'added': [], 'changed': [], 'kept': []}
    diffB = {'added': [], 'changed': [], 'kept': []}
    heads = map(lambda l: l[0], diff)
    lineA = lineB = 0
    i = 0
    # - or + or -?+ or -+? or -?+?
    while i < len(diff):
        # print (i, heads[i])
        lineA += 1
        lineB += 1
        if heads[i] == '-':
            if len(heads) >= i+3 and heads[i+1:i+3] == ['?', '+']:
                diffA['changed'].append(lineA)
                diffB['changed'].append(lineB)
                if heads[i+3] == '?':  # case -?+?
                    # print '-?+?'
                    # diffB['changeInfo'].append(diff[i+1])
                    # diffA['changeInfo'].append(diff[i+3])
                    i += 3
                else:  # case -?+
                    # print '-?+'
                    # diffB['changeInfo'].append(diff[i+1])
                    # diffA['changeInfo'].append('')
                    i += 2
            elif len(heads) >= i+3 and heads[i+1:i+3] == ['+', '?']:  # case -+?
                # print '-+?'
                diffA['changed'].append(lineA)
                diffB['changed'].append(lineB)
                # diffB['changeInfo'].append('')
                # diffA['changeInfo'].append(diff[i+2])
                i += 2
            else:  # case -
                # print '-'
                lineB -= 1
                diffA['added'].append(lineA)
        elif heads[i] == '+':  # case +
            # print '+'
            lineA -= 1
            diffB['added'].append(lineB)
        elif heads[i] == ' ':  # case blank
            # print ' '
            diffA['kept'].append(lineA)
            diffB['kept'].append(lineB)
        i += 1
    # print diffA
    # print diffB

    # map diff information
    iA = iB = 1
    completeA = completeB = False
    while not completeA or not completeB:
        # get blockId
        # print '(BB\d+%s |BB_entry\d+%s)\[shape=' % (fileId, fileId)
        while not completeA and not re.match('(BB\d+%s |BB_entry\d+%s)\[shape=' % (fileId, fileId), dotA[iA-1]):
            # print dotA[iA-1]
            # print re.match('(BB\d+%s |BB_entry\d+%s)\[shape=' % (fileId, fileId), dotA[iA-1])
            iA += 1
            if iA > len(dotA):
                completeA = True
                break
        # print completeA
        # print dotA[iA-1]
        while not completeB and not re.match('(BB\d+%s |BB_entry\d+%s)\[shape=' % (fileId, fileId), dotB[iB-1]):
            iB += 1
            if iB > len(dotB):
                completeB = True
                break
        if not completeA:
            if re.match('BB_entry\d+%s\[shape=' % fileId, dotA[iA-1]):
                blockIdA = dotA[iA-1].split('[')[0]
            else:
                blockIdA = dotA[iA-1].split()[0]
        if not completeB:
            if re.match('BB_entry\d+%s\[shape=' % fileId, dotB[iB-1]):
                blockIdB = dotB[iB-1].split('[')[0]
            else:
                blockIdB = dotB[iB-1].split()[0]

        if iA in diffA['added']:
            diffMapA[blockIdA] = 'added'
            diffMapA['added'].append(blockIdA)
            iA += 1
        elif iB in diffB['added']:
            diffMapB[blockIdB] = 'added'
            diffMapB['added'].append(blockIdB)
            iB += 1
        elif iA in diffA['changed'] and iB in diffB['changed']:
            diffMapA[blockIdA] = blockIdB
            diffMapB[blockIdB] = blockIdA
            diffMapA['changed'].append(blockIdA)
            diffMapB['changed'].append(blockIdB)
            iA += 1
            iB += 1
        elif iA in diffA['kept'] and iB in diffB['kept']:
            diffMapA[blockIdA] = blockIdB
            diffMapB[blockIdB] = blockIdA
            iA += 1
            iB += 1


def reshapeDot(dot, fileId):
    ret = dot
    ret = map(lambda s: re.sub('BB\d+%s' % fileId, 'BB', s), ret)
    ret = map(lambda s: re.sub('BB_entry\d+%s' % fileId, 'BB_entry', s), ret)
    ret = map(lambda s: re.sub('label="<main> function().+"', 'label="<main> function()"', s), ret)
    ret = map(lambda s: re.sub('label="function.+";', 'label="function";', s), ret)
    # ret = map(lambda s: re.sub('subgraph cluster\d+ {', 'subgraph cluster {', s), ret)
    ret = map(lambda s: re.sub('headlabel="\s*\d+"', 'headlabel=""', s), ret)
    ret = map(lambda s: re.sub('\d+: ', 'n: ', s), ret)
    ret = map(lambda s: re.sub('\d+\(~\d+\): ', 'n(~n): ', s), ret)
    ret = map(lambda s: re.sub('-block:\d+', '-block:n', s), ret)
    ret = map(lambda s: re.sub('v\d+', 'v', s), ret)
    ret = map(lambda s: re.sub('\*}" ]', '}" ]', s), ret)
    return ret



def createCDG(cfg, clusterId, funcName, pathToFile):
    # http://staff.cs.upt.ro/~chirila/teaching/upt/c51-pt/aamcij/7113/Fly0145.html
    # Construction of the control-dependence graph To construct the CDG of a control-flow graph G,
    # 1. Add a new entry-node r to G, with an edge r to s to the start node s of G (indicating that the surrounding program might enter G)
    #    and an edge r to exit to the exit node of G (indicating that the surrounding program might not execute G at all).
    cfgModel = nx.DiGraph()
    cfgModel.add_nodes_from(cfg.nodes(data=True))
    edges = map(lambda x: (x[0], x[1]), cfg.edges)
    cfgModel.add_edges_from(edges)
    lasts = filter(lambda x: len(list(cfg.succ[x])) == 0, cfg.nodes)
    en = 'BB_entry'+clusterId
    ex = 'BB_exit'+clusterId
    cfgModel.add_node(ex, shape="record", funcName=funcName, file=pathToFile, label="")
    for l in lasts:
        cfgModel.add_edge(l, ex)
    cfgModel.add_edge(en, ex)
    # nx.nx_agraph.view_pygraphviz(cfgModel, prog='fdp')

    # 2. Let G' be the reverse control-flow graph that has an edge y to x whenever G has an edge x to y;the start node of G' corresponds to the exit node of G.
    rev_cfg = cfgModel.reverse()

    # 3. Construct the dominator tree of G' (its root corresponds to the exit node of G).
    # 4. Calculate the dominance frontiers DF_G' of the nodes of G'.
    df = nx.dominance_frontiers(rev_cfg, ex)
    # print df

    # 5. The CDG has edge x to y whenever x in DF_G'[y].
    cdg = nx.DiGraph()  # control dependence graph
    cdg.add_nodes_from(cfg.nodes(data=True))
    for n, nodes in df.items():
        for m in nodes:
            cdg.add_edge(m, n)
    cdg.add_edge(en, ex)  # might not be neccessary
    # nx.nx_agraph.view_pygraphviz(cdg, prog='fdp')
    return cdg

main()
