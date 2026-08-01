// Lift the foreground subject (horse + rider + flag) out of a photograph or
// painting using Vision's instance-mask segmentation — the same engine behind
// macOS "Copy Subject". Colour-based keying cannot separate a white horse from
// pale sandstone architecture; this can.
//
//   swift scripts/subject_lift.swift in.jpg out.png [--mask mask.png]
import AppKit
import CoreImage
import Foundation
import Vision

let args = CommandLine.arguments
guard args.count >= 3 else {
    print("usage: subject_lift.swift <input> <output.png> [--mask <mask.png>]")
    exit(1)
}
let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])
var maskURL: URL?
if let i = args.firstIndex(of: "--mask"), i + 1 < args.count {
    maskURL = URL(fileURLWithPath: args[i + 1])
}

let ctx = CIContext()

func writePNG(_ image: CGImage, to url: URL) throws {
    let rep = NSBitmapImageRep(cgImage: image)
    guard let data = rep.representation(using: .png, properties: [:]) else {
        throw NSError(domain: "png", code: 1)
    }
    try data.write(to: url)
}

do {
    let handler = VNImageRequestHandler(url: inURL, options: [:])
    let request = VNGenerateForegroundInstanceMaskRequest()
    try handler.perform([request])

    guard let result = request.results?.first else {
        print("no foreground subject detected")
        exit(2)
    }
    print("instances detected: \(result.allInstances.count)")

    // Full frame (not cropped to extent) so the caller controls the crop.
    let masked = try result.generateMaskedImage(
        ofInstances: result.allInstances,
        from: handler,
        croppedToInstancesExtent: false
    )
    let ci = CIImage(cvPixelBuffer: masked)
    guard let cg = ctx.createCGImage(ci, from: ci.extent) else {
        print("could not rasterise masked image")
        exit(3)
    }
    try writePNG(cg, to: outURL)
    print("subject → \(outURL.path)  \(cg.width)x\(cg.height)")

    if let maskURL {
        let scaled = try result.generateScaledMaskForImage(
            forInstances: result.allInstances,
            from: handler
        )
        let mci = CIImage(cvPixelBuffer: scaled)
        if let mcg = ctx.createCGImage(mci, from: mci.extent) {
            try writePNG(mcg, to: maskURL)
            print("mask    → \(maskURL.path)  \(mcg.width)x\(mcg.height)")
        }
    }
} catch {
    print("error: \(error)")
    exit(4)
}
