import { Component, ElementRef, Input, Output, OnChanges,EventEmitter,ViewChild, SimpleChanges} from '@angular/core';
import * as d3 from 'd3';
import {Company, ForceHierarchyLink, ForceHierarchyNode} from "./d3ForceDataTypes";
import {D3DragEvent} from "d3";

@Component({
  selector: 'app-d3ForceChart',
  imports: [],
  template: `
    <div class="h-full">
      <div id="forceTooltip"></div>
      <svg class="baseSvg w-full h-full bg-white">
        <g class="chartSvg">
          <g class="linkGroup"></g>
          <g class="nodeGroup"></g>
        </g>
      </svg>
    </div>
  `,
  styles: ``
})
export class D3ForceChartComponent implements OnChanges {
  @Input() graphData: Company | null = null;
  @Input() radiusVar: "staff" | "salary" |"yearsExperience" = "staff";
  @Output() graphDataChange = new EventEmitter<Company | null>();
  @ViewChild('chart', { static: true }) private chartContainer!: ElementRef<SVGSVGElement>;

  chartData: ForceHierarchyNode<Company> | undefined = undefined;
  radiusExtent: {[key: string]: [number, number]} | undefined = undefined;

  tooltipId: string = "forceTooltip";
  props = {
    defaultRadius: 12,
    radiusRange: [12,60],
    links: {strokeWidth: 1, stroke:"#A0A0A0"},
    nodes: {rootColor: "#A0A0A0",strokeWidth: 0.5,stroke: "#484848"},
    label: {fill:"#484848",fontSize:16}
  }

    ngOnChanges(changes: SimpleChanges) {

        if (changes['graphData'] && changes['graphData'].currentValue !== null) {
            this.chartData = d3.hierarchy<Company>(changes['graphData'].currentValue);
            const chartData = this.chartData;
            // set to starting position with root node visible and children hidden
            chartData.descendants()
                .sort((a,b) => d3.descending(a.depth, b.depth))
                .forEach((d) => {
                    if(d.children){
                        d.data.staff = d3.sum<ForceHierarchyNode<Company>>(d.children, (s) => s.data.staff);
                        d.data.salary = d3.sum<ForceHierarchyNode<Company>>(d.children, (s) => s.data.salary);
                        d.data.yearsExperience = d3.sum<ForceHierarchyNode<Company>>(d.children, (s) => s.data.yearsExperience);
                    }
                })

            const radiusVariables:("staff" | "salary" | "yearsExperience")[] = ["staff","salary","yearsExperience"];
            this.radiusExtent = radiusVariables.reduce((acc, entry) => {
                const currentExtent = d3.extent(chartData.descendants(), (d) => d.data[entry]);
                acc[entry] = [currentExtent[0] || 0, currentExtent[1] || 0]
                return acc;
            },{} as {[key: string]: [number, number]})

            this.chartData.descendants()
                    .forEach((d) => {
                        const lowerDescendants = d.descendants().filter((f) => f.depth > d.depth);
                        if(d.children){
                            if(d.depth >= 0){
                                d._children = d.children; // hiding children using _children is standard d3 practice
                                d.children = undefined;
                            }
                        }
                    });
            this.createForceChart(this.chartData);
        } else if (changes['radiusVar'] && this.chartData){
            this.radiusVar = changes['radiusVar'].currentValue;
            this.createForceChart(this.chartData);
        }
    }


  private measureWidth = (text: string, fontSize: number): number => {
      // for the background label rect
      const context = document.createElement("canvas").getContext("2d");
      if(context){
          context.font = `${fontSize}px Arial`;
          return context.measureText(text).width;
      }
      return 0;
  }

  private  zoomToBounds = (
      currentNodes: ForceHierarchyNode<Company>[],
      baseSvg: any,
      width: number,
      height: number,
      zoom: any) => {
        // get zoom extent and fit to scale
        const [xExtent0, xExtent1] = d3.extent(currentNodes, (d) => d.fx || d.x);
        const [yExtent0, yExtent1] = d3.extent(currentNodes, (d) => d.fy || d.y);
        if (xExtent0 && xExtent1 && yExtent0 && yExtent1) {
            let xWidth = xExtent1 - xExtent0 ;
            let yWidth = yExtent1 - yExtent0;
            let translateX =  -(xExtent0 + xExtent1) / 2;
            let translateY =  -(yExtent0 + yExtent1) / 2;

            const fitToScale = 0.8 / Math.max(xWidth / width, yWidth / height);

            baseSvg
                .interrupt()
                .transition()
                .duration(500)
                .call(
                    zoom.transform,
                    d3.zoomIdentity
                        .translate(width / 2, height / 2)
                        .scale(fitToScale > 1 ? 1 : fitToScale)
                        .translate(fitToScale > 1 ? -width/2 : translateX, fitToScale > 1 ? -height/2 : translateY),
                );
        }
    }




    private createForceChart(data: ForceHierarchyNode<Company>) {

    const baseSvg = d3.select<SVGSVGElement,unknown>(".baseSvg");
    const svgNode = baseSvg.node();
    if(svgNode){
      const {tooltipId,props,radiusExtent, radiusVar} = this;
      const {clientWidth, clientHeight} = svgNode;
      const width = clientWidth;
      const height = clientHeight;
      const chartNodes = data;
      chartNodes.fx = width/2;
      chartNodes.fy = height/2;
      const svg = baseSvg.select(".chartSvg");


      const zoom = d3
          .zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.1,1])
          .on("zoom", (event) => {
            const { x, y, k } = event.transform;
            svg.attr("transform", `translate(${x},${y}) scale(${k})`);

          });

      baseSvg.call(zoom).on("dblclick.zoom", null);

      // base svg click to reset tooltip to hidden
      baseSvg.on("click",(event) => {
        if(event.srcElement.tagName === "svg"){ // need this as otherwise triggers on every click
          d3.select(`#${tooltipId}`)
              .style("visibility", "hidden")
              .html("")
        }
      })

      // set up radius scale - works on the min/max across the hierarchy of the selected radiusVar
      const radiusScale =  d3
          .scaleSqrt()
          .domain(radiusExtent?.[radiusVar] ?? [0, 0])
          .range(props.radiusRange);

      const getColorSet = () => Array.from(
              chartNodes.descendants()
                  .reduce((acc, node) => {
                    acc.add(node.data.type);
                    return acc
                  }, new Set() as Set<string>))

      // by default this is the label variable of the 1st level which is set to "defaultColor" - this can be changed
      let colorDomain = getColorSet();
      const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(colorDomain);

      // select link + node group
      const linkGroup = svg.select(".linkGroup");
      const nodeGroup = svg.select(".nodeGroup");
      // clone hierarchy

       // set simulation = links, radial by depth, don't collide
      const simulation = d3.forceSimulation<ForceHierarchyNode<Company>,ForceHierarchyLink>()
          .force("link", d3.forceLink<ForceHierarchyNode<Company>,ForceHierarchyLink>().id((d) => d.data.name))
          .force("charge",d3.forceManyBody().strength(-1000))
          .force("radial", d3.forceRadial<ForceHierarchyNode<Company>>((d) => d.depth * (width/3), width / 2, height / 2).strength(0.4))
      // so there are no errors fetching as d3 manipulates the data
      const getLinkId = (link: ForceHierarchyLink, linkType: "source" | "target") =>  link[linkType].data.name;


      const fixNodes = (nodes: ForceHierarchyNode<Company>[]) => {
        // stops the wiggling
        nodes.map((m) => {
          if(m.depth > 0){
            m.fx = m.x;
            m.fy = m.y;
          }
        })
      }

      const drawTree = () => {
        // get nodes for this draw + fix them
        const nodes = chartNodes.descendants();
        const links = chartNodes.links();
        fixNodes(nodes);
        // filter links so only those  related to visible nodes
        const chartLinks = links.filter((f) => nodes.some((s) => s.data.name === getLinkId(f, "source")) && nodes.some((s) => s.data.name === getLinkId(f,"target")))
        // linksGroup append
        const linksGroup = linkGroup
            .selectAll<SVGGElement,ForceHierarchyLink[]>(".linksGroup")
            .data(chartLinks)
            .join((group) => {
              const enter = group.append("g").attr("class", "linksGroup");
              enter.append("line").attr("class", "linkLine");
              return enter;
            });

        linksGroup
            .select(".linkLine")
            .attr("stroke-width",props.links.strokeWidth)
            .attr("stroke", props.links.stroke)
            .attr("opacity",0)
            .interrupt()
            .transition()
           // .duration((d) => d.target && d.target.expanded ? 500 : 0)
            .attr("opacity",1); // transition only applies to recently expanded nodes

        // nodes group append
        const nodesGroup = nodeGroup
            .selectAll<SVGGElement,ForceHierarchyNode<Company>[]>(".nodesGroup")
            .data(nodes )
            .join((group) => {
              const enter = group.append("g").attr("class", "nodesGroup");
              enter.append("circle").attr("class", "nodeBackgroundCircle");
              enter.append("circle").attr("class", "nodeCircleOutline");
              enter.append("circle").attr("class", "nodeCircle");
              enter.append("rect").attr("class","nodeLabelBackground")
              enter.append("text").attr("class", "nodeLabel");
              enter.append("g").attr("class","nodePieGroup");
              return enter;
            });


        nodesGroup
            .attr("cursor","pointer")
            .on("click", (event, d) => {
              // populate tooltip
              d3.select(`#${tooltipId}`)
                  .style("visibility", "visible")
                  .html("hello I'm a tooltip");
              // .children === visible, .data._children === hidden
              // flip visibility depending on status and set expanded to true if expanding
              if(!d.children  && d._children){
                d.children = d._children;
                d._children = undefined;
                d.children.map((m) => {
                  m.expanded = true
                });
              } else if (d.children){
                  d._children = d.children;
                  d.children = undefined;
              }
              // redraw
              drawTree();
            })

        nodesGroup // so link doesn't show between circle and dashed circle
            .select(".nodeBackgroundCircle")
            .attr("pointer-events","none")
            .attr("r",  (d) => d.children ? 1 + radiusScale(d.data[radiusVar]) * 1.25 : radiusScale(d.data[radiusVar]))
            .attr("fill", "white")
            .attr("stroke-width", 0)

        nodesGroup
            .select(".nodeCircle")
            .attr("r", (d) => radiusScale(d.data[radiusVar]))
            .attr("fill", (d) => d.depth === 0 ? props.nodes.rootColor : colorScale(d.data.type))
            .attr("stroke", props.nodes.stroke)
            .attr("stroke-width", 0)
            .interrupt()
            .attr("opacity",0)
            .transition()
            .duration((d) => d.expanded ? 500 : 0)
            .attr("opacity",1); // transition only applies to recently expanded nodes

        nodesGroup // dashed circle
            .select(".nodeCircleOutline")
            .attr("pointer-events","none")
            .attr("r",(d) =>  radiusScale(d.data[radiusVar]) + 3)
            .attr("stroke", (d) => d.depth === 0 ? props.nodes.rootColor : colorScale(d.data.type))
            .attr("fill", "none")
            .attr("stroke-dasharray", "2,1")
            .attr("stroke-width", (d) => d.children || d._children ? 1 : 0)

        nodesGroup // rectangle behind label to make it more readable above links
            .select(".nodeLabelBackground")
            .attr("width", (d) => this.measureWidth(d.data.name,props.label.fontSize) + 2)
            .attr("height", props.label.fontSize)
            .attr("x",(d) => -this.measureWidth(d.data.name,props.label.fontSize)/2 - 1)
            .attr("y",(d) =>  radiusScale(d.data[radiusVar]) + 1.5 + (d.children || d._children ? 3 : 0))
            .attr("rx",3)
            .attr("ry",3)
            .attr("fill","white");

        nodesGroup
            .select(".nodeLabel")
            .attr("fill", props.label.fill)
            .attr("font-size",props.label.fontSize)
            .attr("dx", 0)
            .attr("dy", (d) => props.label.fontSize + radiusScale(d.data[radiusVar]) + (d.children || d._children ? 3 : 0))
            .attr("text-anchor", "middle")
            .text((d) =>d.data.name)
            .attr("opacity",0)
            .interrupt()
            .transition()
            .delay((d) => d.expanded ? 200 : 0)
            .duration((d) => d.expanded ? 500 : 0)
            .attr("opacity",1); // transition only applies to recently expanded nodes

        // standard d3 drag functionality - fixNodes on start so only node in question moves
        const dragstarted = (event: D3DragEvent<SVGGElement, ForceHierarchyNode<Company>,unknown>, d: ForceHierarchyNode<Company>) => {
          if(d.depth > 0) {
            fixNodes(nodes);
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          }
        };

        const dragged = (event: D3DragEvent<SVGGElement, ForceHierarchyNode<Company>,unknown>, d:ForceHierarchyNode<Company>) => {
          if(d.depth > 0) {
            d.fx = event.x;
            d.fy = event.y;
          }
        };

        const dragended = (event: D3DragEvent<SVGGElement, ForceHierarchyNode<Company>,unknown>) => {
          if (!event.active) simulation.alphaTarget(0);
        };
        // trigger drag functionality
        nodesGroup.call(
            d3.drag<SVGGElement, ForceHierarchyNode<Company>>()
                .on("start", dragstarted)
                .on("drag", dragged).on("end", dragended)
        );

        // reset so none expanded (and no transition)
        nodes.map((m) => m.expanded = false);
        // simulation settings
        simulation.nodes(nodes);
        const linkForce = simulation.force("link");
        if (linkForce && "links" in linkForce) {
          (linkForce as d3.ForceLink<ForceHierarchyNode<Company>,ForceHierarchyLink>).links(chartLinks);
        }
        simulation.alpha(1).restart();

        let tickCount = 0;
        simulation.on("tick", () => {
          svg
              .selectAll<SVGLineElement,ForceHierarchyLink>(".linkLine")
              .attr("x1", (d) => d.source.x || 0)
              .attr("x2", (d) => d.target.x || 0)
              .attr("y1", (d) => d.source.y || 0)
              .attr("y2", (d) => d.target.y || 0);

          nodesGroup
              .attr("transform", (d) => `translate(${d.x},${d.y})`);
          tickCount += 1;
          if(tickCount === 25){
            // zoom after 25 ticks so nodes pretty much in place
            this.zoomToBounds(nodes, baseSvg,width,height,zoom);
          }
        })
      }

      // initial chart draw
      drawTree();



    }

  }
}
