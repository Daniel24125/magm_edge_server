# aws_authorization_test.py
import boto3

def test_iot_permissions(role_arn: str, region: str = "eu-west-3"):
    """
    Checks if the given IAM Role has permission to perform IoT actions on specific topics.
    Works for WebSocket IAM-based authentication.
    """
    iam = boto3.client("iam", region_name=region)

    actions = [
        "iot:Connect",
        "iot:Subscribe",
        "iot:Publish",
        "iot:Receive"
    ]

    resources = [
        "arn:aws:iot:eu-west-3:820135570820:client/*",
        "arn:aws:iot:eu-west-3:820135570820:topic/ui/commands/#",
        "arn:aws:iot:eu-west-3:820135570820:topicfilter/ui/commands/#"
    ]

    print(f"\n🔍 Testing IoT permissions for role: {role_arn}\n")

    for action in actions:
        response = iam.simulate_principal_policy(
            PolicySourceArn=role_arn,
            ActionNames=[action],
            ResourceArns=resources
        )

        decisions = [
            (r["EvalActionName"], r["EvalResourceName"], r["EvalDecision"])
            for r in response["EvaluationResults"]
        ]
        for a, rsrc, decision in decisions:
            print(f"Action: {a:15s} | Resource: {rsrc:80s} | Decision: {decision}")

    print("\n✅ If all show ALLOWED, your role policy is correct.\n")


if __name__ == "__main__":
    role_arn = "arn:aws:iam::820135570820:role/IoTEdgeServerRole"
    test_iot_permissions(role_arn)
