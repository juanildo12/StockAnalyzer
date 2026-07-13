#!/usr/bin/env python3
"""
Generate a dual-head TFLite stock classifier model.

Architecture: 10 inputs → 32 hidden → 16 hidden → 2 output heads
  Head 1 (day):  BUY/HOLD/SELL for daytrading (1-5 days)
  Head 2 (swing): BUY/HOLD/SELL for swing trading (weeks)

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
    """
    Dual-head MLP: shared hidden layers + specialized output heads.

    Daytrading head focuses on: RSI, volume, momentum, dist_52w_high
    Swing head focuses on: PE, FCF yield, revenue growth, profit margin
    """
    np.random.seed(42)

    # Shared Layer 1: 10 inputs -> 32 hidden
    w1 = np.random.randn(10, 32).astype(np.float32) * 0.2
    b1 = np.zeros(32, dtype=np.float32)

    # Value neurons
    w1[0, 0] = -0.9; w1[1, 0] = 1.0; b1[0] = -0.1
    w1[0, 1] = -1.2; w1[1, 1] = 0.8; w1[8, 1] = 0.3; b1[1] = 0.2

    # Growth neurons
    w1[2, 2] = 0.9; w1[3, 2] = 0.7; w1[9, 2] = -0.4; b1[2] = -0.5
    w1[2, 3] = -0.8; w1[3, 3] = -0.6; b1[3] = 0.3

    # Technical neurons (important for daytrading)
    w1[4, 4] = -1.0; w1[6, 4] = 0.3; b1[4] = 0.5      # Oversold -> BUY
    w1[4, 5] = 1.1; w1[7, 5] = 0.4; b1[5] = -0.4       # Overbought -> SELL
    w1[7, 6] = 0.7; w1[5, 6] = -0.5; b1[6] = 0.0        # Momentum up
    w1[7, 7] = -0.8; w1[5, 7] = 0.3; b1[7] = 0.0        # Momentum down

    # Risk neurons (important for swing)
    w1[9, 8] = 0.9; w1[8, 8] = -0.4; b1[8] = -0.8
    w1[9, 9] = -0.7; w1[3, 9] = 0.5; b1[9] = 0.2

    # Market cap / volume neurons
    w1[8, 10] = 0.6; w1[4, 10] = -0.2; b1[10] = 0.0
    w1[8, 11] = -0.5; w1[6, 11] = 0.3; b1[11] = 0.1
    w1[6, 12] = 0.8; w1[7, 12] = 0.3; b1[12] = 0.0
    w1[6, 13] = -0.6; b1[13] = 0.1

    # Shared Layer 2: 32 -> 16
    w2 = np.random.randn(32, 16).astype(np.float32) * 0.25
    b2 = np.zeros(16, dtype=np.float32)

    # === DAYTRADING HEAD (technical signals) ===
    w3_day = np.random.randn(16, 3).astype(np.float32) * 0.3
    b3_day = np.zeros(3, dtype=np.float32)

    # Day BUY: oversold RSI + momentum + volume spike
    w3_day[4, 0] = 1.0   # oversold neuron
    w3_day[6, 0] = 0.8   # momentum up
    w3_day[12, 0] = 0.7  # volume up
    w3_day[0, 0] = 0.3   # cheap value helps
    b3_day[0] = -0.3

    # Day HOLD
    w3_day[7, 1] = 0.6   # neutral momentum
    w3_day[12, 1] = 0.3  # normal volume
    b3_day[1] = 0.5

    # Day SELL: overbought + negative momentum
    w3_day[5, 2] = 1.0   # overbought neuron
    w3_day[13, 2] = 0.7  # volume down
    w3_day[9, 2] = 0.4   # risk
    b3_day[2] = -0.2

    # === SWING HEAD (fundamental signals) ===
    w3_swing = np.random.randn(16, 3).astype(np.float32) * 0.3
    b3_swing = np.zeros(3, dtype=np.float32)

    # Swing BUY: value + growth + low risk
    w3_swing[0, 0] = 0.9   # value neuron
    w3_swing[1, 0] = 0.7   # growth neuron
    w3_swing[2, 0] = 0.6   # growth neuron
    w3_swing[10, 0] = 0.4  # market cap
    b3_swing[0] = -0.3

    # Swing HOLD
    w3_swing[6, 1] = 0.5
    w3_swing[11, 1] = 0.3
    b3_swing[1] = 0.4

    # Swing SELL: overvalued + risk + declining
    w3_swing[5, 2] = 0.5   # overbought
    w3_swing[3, 2] = 0.7   # growth declining
    w3_swing[8, 2] = 0.8   # high risk
    w3_swing[9, 2] = 0.5   # high debt
    b3_swing[2] = -0.2

    return w1, b1, w2, b2, w3_day, b3_day, w3_swing, b3_swing


def forward_pass(features, w1, b1, w2, b2, w3_day, b3_day, w3_swing, b3_swing):
    h1 = relu(features @ w1 + b1)
    h2 = relu(h1 @ w2 + b2)
    day_out = softmax(h2 @ w3_day + b3_day)
    swing_out = softmax(h2 @ w3_swing + b3_swing)
    return day_out, swing_out


def create_tflite_model(w1, b1, w2, b2, w3_day, b3_day, w3_swing, b3_swing):
    """
    Create a dual-head TFLite model with float32 weights.
    Network: input(10) -> FC(32) -> FC(16) -> Concat(day_out=3, swing_out=3) -> output(6)

    Actually, simpler: two separate FC ops from h2 to produce two output tensors,
    then we return both. The model has subgraph outputs = [day_tensor, swing_tensor].

    For simplicity, we do: FC(h2, w3_day, b3_day) -> day_out, FC(h2, w3_swing, b3_swing) -> swing_out.
    Model outputs both tensors.
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

    # Buffers: 0=empty, 1=input, 2=w1, 3=b1, 4=w2, 5=b2, 6=w3_day, 7=b3_day, 8=w3_swing, 9=b3_swing
    bufs = [
        make_buffer(b''),                                              # 0
        make_buffer(np.zeros(10, dtype=np.float32).tobytes()),        # 1
        make_buffer(w1.tobytes()),                                     # 2
        make_buffer(b1.tobytes()),                                     # 3
        make_buffer(w2.tobytes()),                                     # 4
        make_buffer(b2.tobytes()),                                     # 5
        make_buffer(w3_day.tobytes()),                                 # 6
        make_buffer(b3_day.tobytes()),                                 # 7
        make_buffer(w3_swing.tobytes()),                               # 8
        make_buffer(b3_swing.tobytes()),                               # 9
    ]

    # Tensors
    # 0=input, 1=w1, 2=b1, 3=h1_out, 4=w2, 5=b2, 6=h2_out, 7=w3_day, 8=b3_day, 9=day_out, 10=w3_swing, 11=b3_swing, 12=swing_out
    t_input   = make_tensor('input',    [1, 10], 1)
    t_w1      = make_tensor('w1',       [10, 32], 2)
    t_b1      = make_tensor('b1',       [32], 3)
    t_h1      = make_tensor('h1_out',   [1, 32], 0)
    t_w2      = make_tensor('w2',       [32, 16], 4)
    t_b2      = make_tensor('b2',       [16], 5)
    t_h2      = make_tensor('h2_out',   [1, 16], 0)
    t_w3d     = make_tensor('w3_day',   [16, 3], 6)
    t_b3d     = make_tensor('b3_day',   [3], 7)
    t_day     = make_tensor('day_out',  [1, 3], 0)
    t_w3s     = make_tensor('w3_swing', [16, 3], 8)
    t_b3s     = make_tensor('b3_swing', [3], 9)
    t_swing   = make_tensor('swing_out',[1, 3], 0)

    # Operators: FC only + SOFTMAX
    # op_codes: 0=FULLY_CONNECTED, 1=SOFTMAX
    tensors_vec = offset_vec([
        t_input, t_w1, t_b1, t_h1,
        t_w2, t_b2, t_h2,
        t_w3d, t_b3d, t_day,
        t_w3s, t_b3s, t_swing,
    ])

    op_fc1     = make_op(0, [0, 1, 2], [3])       # input -> h1
    op_fc2     = make_op(0, [3, 4, 5], [6])       # h1 -> h2
    op_fc_day  = make_op(0, [6, 7, 8], [9])       # h2 -> day_out
    op_fc_swing= make_op(0, [6, 10, 11], [12])    # h2 -> swing_out
    op_sm_day  = make_op(1, [9], [9])              # softmax day
    op_sm_swing= make_op(1, [12], [12])            # softmax swing

    ops_vec = offset_vec([op_fc1, op_fc2, op_fc_day, op_sm_day, op_fc_swing, op_sm_swing])

    inputs_vec  = int32_vec([0])
    outputs_vec = int32_vec([9, 12])  # day_out and swing_out

    # Subgraph
    tflite.SubGraphStart(builder)
    tflite.SubGraphAddTensors(builder, tensors_vec)
    tflite.SubGraphAddInputs(builder, inputs_vec)
    tflite.SubGraphAddOutputs(builder, outputs_vec)
    tflite.SubGraphAddOperators(builder, ops_vec)
    subgraph = tflite.SubGraphEnd(builder)

    # Op codes
    def make_op_code(builtin):
        tflite.OperatorCodeStart(builder)
        tflite.OperatorCodeAddBuiltinCode(builder, builtin)
        return tflite.OperatorCodeEnd(builder)

    op_codes_vec = offset_vec([
        make_op_code(tflite.BuiltinOperator.FULLY_CONNECTED),
        make_op_code(tflite.BuiltinOperator.SOFTMAX),
    ])

    # Model
    buffers_vec = offset_vec(bufs)
    desc_off = builder.CreateString('DualHead Stock Classifier v2')
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
    print("Dual-Head Stock Classifier - TFLite Model Generator")
    print("=" * 60)

    w1, b1, w2, b2, w3d, b3d, w3s, b3s = generate_heuristic_weights()
    print(f"\nWeight shapes:")
    print(f"  Shared L1: W={w1.shape}, b={b1.shape}")
    print(f"  Shared L2: W={w2.shape}, b={b2.shape}")
    print(f"  Day head:   W={w3d.shape}, b={b3d.shape}")
    print(f"  Swing head: W={w3s.shape}, b={b3s.shape}")

    print("\n--- Forward pass verification ---")
    test_cases = [
        ("Value stock",      np.array([12, 8, 15, 20, 35, 20, 1.2, 2, 11, 40])),
        ("Oversold + cheap", np.array([10, 10, 10, 15, 25, 35, 1.8, -2, 11, 50])),
        ("Overbought growth",np.array([50, 2, 25, 10, 78, 2, 2.0, 5, 12, 80])),
        ("Danger zone",      np.array([80, -2, -10, -5, 70, 1, 0.5, -8, 9, 200])),
        ("Momentum play",    np.array([30, 3, 5, 8, 45, 10, 2.5, 6, 10, 60])),
    ]

    for name, features in test_cases:
        day, swing = forward_pass(features, w1, b1, w2, b2, w3d, b3d, w3s, b3s)
        day_pred = LABELS[np.argmax(day)]
        swing_pred = LABELS[np.argmax(swing)]
        print(f"  {name:20s}:")
        print(f"    Day:   BUY={day[0]:.3f} HOLD={day[1]:.3f} SELL={day[2]:.3f} -> {day_pred}")
        print(f"    Swing: BUY={swing[0]:.3f} HOLD={swing[1]:.3f} SELL={swing[2]:.3f} -> {swing_pred}")

    # Generate TFLite model
    print("\n--- Generating TFLite model ---")
    model_bytes = create_tflite_model(w1, b1, w2, b2, w3d, b3d, w3s, b3s)

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
