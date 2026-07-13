#!/usr/bin/env python3
"""
Generate a pre-trained TFLite stock classifier model.

Creates a small 3-layer neural network (10->32->16->3) with pre-computed
weights that encode general stock analysis heuristics, then exports
to TFLite format.

Usage:
    pip install tflite numpy flatbuffers
    python generate_model.py
"""

import os
import numpy as np

FEATURE_NAMES = [
    'pe_ratio', 'fcf_yield', 'revenue_growth', 'profit_margin',
    'rsi_14', 'dist_52w_high', 'volume_ratio', 'change_5d',
    'log_market_cap', 'debt_to_equity',
]

LABELS = ['BUY', 'HOLD', 'SELL']


def relu(x):
    return np.maximum(0, x)


def softmax(x):
    e = np.exp(x - np.max(x))
    return e / e.sum()


def generate_heuristic_weights():
    np.random.seed(42)

    w1 = np.random.randn(10, 32).astype(np.float32) * 0.2
    b1 = np.zeros(32, dtype=np.float32)

    w1[0, 0] = -0.9; w1[1, 0] = 1.0; b1[0] = -0.1
    w1[0, 1] = -1.2; w1[1, 1] = 0.8; w1[8, 1] = 0.3; b1[1] = 0.2

    w1[2, 2] = 0.9; w1[3, 2] = 0.7; w1[9, 2] = -0.4; b1[2] = -0.5
    w1[2, 3] = -0.8; w1[3, 3] = -0.6; b1[3] = 0.3

    w1[4, 4] = -1.0; w1[6, 4] = 0.3; b1[4] = 0.5
    w1[4, 5] = 1.1; w1[7, 5] = 0.4; b1[5] = -0.4
    w1[7, 6] = 0.7; w1[5, 6] = -0.5; b1[6] = 0.0
    w1[7, 7] = -0.8; w1[5, 7] = 0.3; b1[7] = 0.0

    w1[9, 8] = 0.9; w1[8, 8] = -0.4; b1[8] = -0.8
    w1[9, 9] = -0.7; w1[3, 9] = 0.5; b1[9] = 0.2

    w1[8, 10] = 0.6; w1[4, 10] = -0.2; b1[10] = 0.0
    w1[8, 11] = -0.5; w1[6, 11] = 0.3; b1[11] = 0.1

    w1[6, 12] = 0.8; w1[7, 12] = 0.3; b1[12] = 0.0
    w1[6, 13] = -0.6; b1[13] = 0.1

    w2 = np.random.randn(32, 16).astype(np.float32) * 0.25
    b2 = np.zeros(16, dtype=np.float32)

    w3 = np.random.randn(16, 3).astype(np.float32) * 0.3
    b3 = np.zeros(3, dtype=np.float32)

    w3[0, 0] = 0.9; w3[1, 0] = 0.7; w3[4, 0] = 0.8
    w3[2, 0] = 0.5; w3[10, 0] = 0.4
    b3[0] = -0.3

    w3[6, 1] = 0.5; w3[7, 1] = 0.5; w3[12, 1] = 0.4
    w3[11, 1] = 0.3
    b3[1] = 0.4

    w3[5, 2] = 0.9; w3[3, 2] = 0.7; w3[8, 2] = 0.8
    w3[9, 2] = 0.5; w3[13, 2] = 0.4
    b3[2] = -0.2

    return w1, b1, w2, b2, w3, b3


def forward_pass(features, w1, b1, w2, b2, w3, b3):
    h1 = relu(features @ w1 + b1)
    h2 = relu(h1 @ w2 + b2)
    out = softmax(h2 @ w3 + b3)
    return out


def create_tflite_model(w1, b1, w2, b2, w3, b3):
    """
    Create a TFLite float32 model.
    Key rule: ALL child offsets must be created BEFORE the parent table/vector
    that references them.
    """
    import tflite
    import flatbuffers

    builder = flatbuffers.Builder(131072)

    def int32_vec(values):
        builder.StartVector(4, len(values), 4)
        for v in reversed(values):
            builder.PrependInt32(v)
        return builder.EndVector()

    def offset_vec(offsets):
        builder.StartVector(4, len(offsets), 4)
        for o in reversed(offsets):
            builder.PrependSOffsetTRelative(o)
        return builder.EndVector()

    def make_buffer(data_bytes):
        if data_bytes:
            data_off = builder.CreateString(data_bytes)
            tflite.BufferStart(builder)
            tflite.BufferAddData(builder, data_off)
        else:
            tflite.BufferStart(builder)
        return tflite.BufferEnd(builder)

    def make_tensor(name, shape, buf_idx):
        name_off = builder.CreateString(name)
        shape_off = int32_vec(shape)
        tflite.TensorStart(builder)
        tflite.TensorAddName(builder, name_off)
        tflite.TensorAddShape(builder, shape_off)
        tflite.TensorAddType(builder, tflite.TensorType.FLOAT32)
        tflite.TensorAddBuffer(builder, buf_idx)
        return tflite.TensorEnd(builder)

    def make_op(opcode_index, input_idxs, output_idxs):
        inputs = int32_vec(input_idxs)
        outputs = int32_vec(output_idxs)
        tflite.OperatorStart(builder)
        tflite.OperatorAddOpcodeIndex(builder, opcode_index)
        tflite.OperatorAddInputs(builder, inputs)
        tflite.OperatorAddOutputs(builder, outputs)
        return tflite.OperatorEnd(builder)

    # =========================================================================
    # STEP 1: Create all scalar/string data buffers
    # =========================================================================
    empty_buf   = make_buffer(b'')
    input_buf   = make_buffer(np.zeros(10, dtype=np.float32).tobytes())
    w1_buf      = make_buffer(w1.tobytes())
    b1_buf      = make_buffer(b1.tobytes())
    w2_buf      = make_buffer(w2.tobytes())
    b2_buf      = make_buffer(b2.tobytes())
    w3_buf      = make_buffer(w3.tobytes())
    b3_buf      = make_buffer(b3.tobytes())

    # =========================================================================
    # STEP 2: Create all tensors (they reference buffers by index, not offset)
    # =========================================================================
    input_t  = make_tensor('input',  [1, 10], 1)
    w1_t     = make_tensor('w1',     [10, 32], 2)
    b1_t     = make_tensor('b1',     [32], 3)
    h1_t     = make_tensor('h1_out', [1, 32], 0)  # output buffer = empty
    w2_t     = make_tensor('w2',     [32, 16], 4)
    b2_t     = make_tensor('b2',     [16], 5)
    h2_t     = make_tensor('h2_out', [1, 16], 0)
    w3_t     = make_tensor('w3',     [16, 3], 6)
    b3_t     = make_tensor('b3',     [3], 7)
    output_t = make_tensor('output', [1, 3], 0)

    # =========================================================================
    # STEP 3: Create all operators (they reference tensors by index)
    # =========================================================================
    # Tensor indices: input=0, w1=1, b1=2, h1_out=3, w2=4, b2=5, h2_out=6,
    #                 w3=7, b3=8, output=9
    # Opcode indices: 0=FULLY_CONNECTED, 1=SOFTMAX
    op_fc1    = make_op(0, [0, 1, 2], [3])
    op_fc2    = make_op(0, [3, 4, 5], [6])
    op_fc3    = make_op(0, [6, 7, 8], [9])
    op_softmax = make_op(1, [9], [9])

    # =========================================================================
    # STEP 4: Create vectors of offsets (must be done before subgraph/model)
    # =========================================================================
    tensors_vec = offset_vec([input_t, w1_t, b1_t, h1_t,
                              w2_t, b2_t, h2_t,
                              w3_t, b3_t, output_t])
    ops_vec     = offset_vec([op_fc1, op_fc2, op_fc3, op_softmax])
    inputs_vec  = int32_vec([0])
    outputs_vec = int32_vec([9])

    # =========================================================================
    # STEP 5: Create subgraph (references tensors_vec, ops_vec, inputs, outputs)
    # =========================================================================
    tflite.SubGraphStart(builder)
    tflite.SubGraphAddTensors(builder, tensors_vec)
    tflite.SubGraphAddInputs(builder, inputs_vec)
    tflite.SubGraphAddOutputs(builder, outputs_vec)
    tflite.SubGraphAddOperators(builder, ops_vec)
    subgraph = tflite.SubGraphEnd(builder)

    # =========================================================================
    # STEP 6: Create operator codes
    # =========================================================================
    def make_op_code(builtin):
        tflite.OperatorCodeStart(builder)
        tflite.OperatorCodeAddBuiltinCode(builder, builtin)
        return tflite.OperatorCodeEnd(builder)

    op_code_fc  = make_op_code(tflite.BuiltinOperator.FULLY_CONNECTED)
    op_code_sm  = make_op_code(tflite.BuiltinOperator.SOFTMAX)
    op_codes_vec = offset_vec([op_code_fc, op_code_sm])

    # =========================================================================
    # STEP 7: Create buffers vector (must be after all individual buffers)
    # =========================================================================
    buffers_vec = offset_vec([empty_buf, input_buf, w1_buf, b1_buf,
                              w2_buf, b2_buf, w3_buf, b3_buf])

    # =========================================================================
    # STEP 8: Create model (references everything above)
    # =========================================================================
    desc_off = builder.CreateString('Stock Classifier v1')
    subgraphs_vec = offset_vec([subgraph])

    tflite.ModelStart(builder)
    tflite.ModelAddVersion(builder, 3)
    tflite.ModelAddOperatorCodes(builder, op_codes_vec)
    tflite.ModelAddSubgraphs(builder, subgraphs_vec)
    tflite.ModelAddDescription(builder, desc_off)
    tflite.ModelAddBuffers(builder, buffers_vec)
    model = tflite.ModelEnd(builder)

    builder.Finish(model)
    return bytes(builder.Output())


def main():
    print("=" * 60)
    print("Stock Classifier - TFLite Model Generator")
    print("=" * 60)

    w1, b1, w2, b2, w3, b3 = generate_heuristic_weights()
    print(f"\nWeight shapes:")
    print(f"  Layer 1: W={w1.shape}, b={b1.shape}")
    print(f"  Layer 2: W={w2.shape}, b={b2.shape}")
    print(f"  Layer 3: W={w3.shape}, b={b3.shape}")

    print("\n--- Forward pass verification ---")
    test_cases = [
        ("Value stock", np.array([12, 8, 15, 20, 35, 20, 1.2, 2, 11, 40])),
        ("Growth stock", np.array([45, 2, 30, 10, 55, 5, 1.8, 3, 12, 60])),
        ("Overbought", np.array([30, 3, 5, 8, 78, 2, 2.0, 5, 10, 80])),
        ("Oversold gem", np.array([8, 12, 20, 25, 25, 40, 1.5, -3, 11, 30])),
        ("Danger zone", np.array([80, -2, -10, -5, 70, 1, 0.5, -8, 9, 200])),
    ]

    for name, features in test_cases:
        probs = forward_pass(features, w1, b1, w2, b2, w3, b3)
        pred = LABELS[np.argmax(probs)]
        print(f"  {name:20s}: BUY={probs[0]:.3f} HOLD={probs[1]:.3f} SELL={probs[2]:.3f} -> {pred}")

    print("\n--- Generating TFLite model ---")
    model_bytes = create_tflite_model(w1, b1, w2, b2, w3, b3)

    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'models')
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, 'stock_classifier.tflite')

    with open(output_path, 'wb') as f:
        f.write(model_bytes)

    size_kb = len(model_bytes) / 1024
    print(f"Model saved: {output_path}")
    print(f"Model size: {size_kb:.1f} KB")

    import json
    scaler_params = {
        'mean': [25.0, 3.0, 12.0, 15.0, 50.0, 30.0, 1.2, 0.0, 10.5, 80.0],
        'scale': [20.0, 4.0, 15.0, 12.0, 18.0, 20.0, 0.6, 4.0, 1.5, 60.0],
        'feature_names': FEATURE_NAMES,
    }
    scaler_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scaler_params.json')
    with open(scaler_path, 'w') as f:
        json.dump(scaler_params, f, indent=2)
    print(f"Scaler params saved: {scaler_path}")

    print("\nDone!")


if __name__ == '__main__':
    main()
