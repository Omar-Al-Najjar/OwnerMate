from __future__ import annotations

import pandas as pd
import streamlit as st

from pipeline import get_runtime_summary, run_analysis

st.set_page_config(
    page_title="OwnerMate AI",
    page_icon="AI",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown(
    """
    <style>
    .priority-high { background:#fde8e8; border-left:4px solid #e53e3e; padding:12px 16px; border-radius:6px; margin-bottom:8px; }
    .priority-medium { background:#fef3cd; border-left:4px solid #d69e2e; padding:12px 16px; border-radius:6px; margin-bottom:8px; }
    .priority-low { background:#e8f5e9; border-left:4px solid #38a169; padding:12px 16px; border-radius:6px; margin-bottom:8px; }
    .label { font-size:0.78rem; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:.05em; margin-top:10px; margin-bottom:2px; }
    </style>
    """,
    unsafe_allow_html=True,
)


def render_error_state(result: dict) -> None:
    error = result.get("error") or {}
    st.error(error.get("message", "The analysis failed."))
    if error.get("details"):
        with st.expander("Debug Details", expanded=False):
            st.code(error["details"], language=None)


def render_success_state(result: dict) -> None:
    data = result["data"]
    meta = result["meta"]
    dataset = data["dataset"]
    insights = data["insights"]
    findings = data["findings"]
    questions = data["questions"]
    semantic_model = data["semantic_model"]
    run = data["run"]

    if result["status"] == "partial_success":
        st.warning(
            f"Analysis completed with {meta['failed_queries']} failed quer"
            f"{'y' if meta['failed_queries'] == 1 else 'ies'}. The rest of the report is still usable."
        )

    top1, top2, top3, top4 = st.columns(4)
    top1.metric("Rows", f"{dataset['row_count']:,}")
    top2.metric("Columns", dataset["column_count"])
    top3.metric("Questions", meta["question_count"])
    top4.metric("Run Time", f"{meta['duration_ms'] / 1000:.1f}s")

    tab_insights, tab_findings, tab_questions, tab_schema, tab_run = st.tabs(
        ["Insights", "Findings", "Questions", "Semantic Model", "Run"]
    )

    with tab_insights:
        if insights["executive_summary"]:
            st.subheader("Executive Summary")
            st.info(insights["executive_summary"])
        else:
            st.info("No executive summary was generated.")

        if insights["positive_highlights"]:
            st.subheader("What Is Working Well")
            for item in insights["positive_highlights"]:
                st.success(item)

        st.subheader("Action Items")
        priority_style = {
            "High": "priority-high",
            "Medium": "priority-medium",
            "Low": "priority-low",
        }
        if insights["action_items"]:
            for action in insights["action_items"]:
                label = action["priority"]
                with st.expander(f"{label} Priority - {action['title']}", expanded=(label == "High")):
                    st.markdown(f"<div class='{priority_style.get(label, 'priority-low')}'>", unsafe_allow_html=True)
                    st.markdown('<p class="label">What Is Happening</p>', unsafe_allow_html=True)
                    st.write(action["what"])
                    st.markdown('<p class="label">Why It Matters</p>', unsafe_allow_html=True)
                    st.write(action["why_it_matters"])
                    st.markdown('<p class="label">Recommendation</p>', unsafe_allow_html=True)
                    st.write(action["recommendation"])
                    st.markdown('<p class="label">Expected Impact</p>', unsafe_allow_html=True)
                    st.write(action["expected_impact"])
                    st.markdown("</div>", unsafe_allow_html=True)
        else:
            st.info("No action items were generated.")

        st.subheader("Watch Out For")
        if insights["watch_out_for"]:
            for warning in insights["watch_out_for"]:
                st.warning(warning)
        else:
            st.info("No watch-outs were generated.")

    with tab_findings:
        summary1, summary2, summary3 = st.columns(3)
        summary1.metric("Total Questions", findings["total"])
        summary2.metric("Successful Queries", findings["successful_count"])
        summary3.metric("Failed Queries", findings["failed_count"])

        if findings["successful"]:
            st.markdown("#### Successful Queries")
            for item in findings["successful"]:
                with st.expander(item["question"]):
                    st.markdown('<p class="label">Generated Code</p>', unsafe_allow_html=True)
                    st.code(item["query"], language="python")
                    st.markdown('<p class="label">Actual Result</p>', unsafe_allow_html=True)
                    st.text(item["actual_result"] or "")
                    st.markdown('<p class="label">Business Explanation</p>', unsafe_allow_html=True)
                    st.write(item["explanation"])
        else:
            st.info("No successful queries were produced.")

        if findings["failed"]:
            st.markdown("#### Failed Queries")
            for item in findings["failed"]:
                with st.expander(item["question"]):
                    st.error(item["error"] or "Unknown query failure")
                    if item["query"]:
                        st.code(item["query"], language="python")

    with tab_questions:
        if questions["dataset_understanding"]:
            st.markdown(f"**Dataset Understanding:** {questions['dataset_understanding']}")
        st.caption(
            f"Generated {questions['total']} questions with a floor of {questions['question_floor']}."
        )
        st.caption(f"Priority questions: {questions['priority_count']}")

        if questions["groups"]:
            for category, items in questions["groups"].items():
                with st.expander(f"{category} - {len(items)} question(s)", expanded=False):
                    for item in items:
                        prefix = "Star" if item["priority"] else "Dash"
                        st.markdown(f"**{prefix}:** {item['question']}" if item["priority"] else item["question"])
                        if item["priority_reason"]:
                            st.caption(item["priority_reason"])
        else:
            st.info("No analytical questions were generated.")

    with tab_schema:
        head1, head2 = st.columns(2)
        head1.metric("Dataset", semantic_model["dataset_name"] or dataset["dataset_name"])
        head2.metric("Rows", f"{semantic_model['row_count']:,}")

        if semantic_model["dataset_description"]:
            st.write(semantic_model["dataset_description"])
        st.caption(f"Inferred domain: {semantic_model['inferred_domain'] or 'unknown'}")

        if semantic_model["columns"]:
            st.dataframe(pd.DataFrame(semantic_model["columns"]), use_container_width=True, hide_index=True)
        else:
            st.info("No semantic model details are available.")

        if semantic_model["primary_keys"]:
            st.markdown(f"**Primary keys:** `{', '.join(semantic_model['primary_keys'])}`")
        if semantic_model["time_column"]:
            st.markdown(f"**Time column:** `{semantic_model['time_column']}`")
        if semantic_model["relationships"]:
            st.markdown("**Relationships**")
            for relation in semantic_model["relationships"]:
                st.write(f"- {relation}")
        if semantic_model["missing_values"]:
            st.markdown("**Missing values**")
            st.dataframe(pd.DataFrame(semantic_model["missing_values"]), use_container_width=True, hide_index=True)

    with tab_run:
        st.markdown(f"**Status:** {run['status_label']}")
        st.markdown(f"**Model:** `{meta['model']}`")
        if run["refinement"]:
            st.markdown("**Refinement**")
            st.json(run["refinement"])
        if run["events"]:
            st.markdown("**Pipeline Events**")
            for event in run["events"]:
                st.text(event)
        if run["log"]:
            with st.expander("Raw Pipeline Log", expanded=False):
                st.code(run["log"], language=None)


with st.sidebar:
    runtime = get_runtime_summary()
    st.markdown("## Configuration")
    st.markdown("---")
    if runtime["api_key_configured"]:
        st.success("Server API key detected.")
    else:
        st.error("Missing `OWNERMATE_LLM_API_KEY` on the server.")
    st.caption(f"Model: {runtime['model']}")
    st.caption(f"Base URL: {runtime['base_url']}")
    st.caption(f"Batch size: {runtime['batch_size']}")
    st.caption(f"Agent timeout: {runtime['agent_timeout']}s")
    st.markdown("---")
    st.markdown(
        """
        **Reference UI shell**

        This page is intentionally thin. It renders only the public
        `task_type/status/data/meta/error` contract returned by `pipeline.py`
        so a frontend engineer can port the same behavior without depending
        on internal pipeline models.
        """
    )

st.title("OwnerMate AI - Business Data Analyst")
st.markdown(
    "Upload a business CSV to run the multi-agent analysis prototype. "
    "This is the current frontend handoff shell for the dataset-analysis flow."
)
st.markdown("---")

uploaded_file = st.file_uploader(
    "Upload business data (CSV)",
    type=["csv"],
    help="The prototype accepts generic business datasets such as sales, transactions, customer records, or inventory exports.",
)

if uploaded_file is None:
    st.info("Upload a CSV to enter the ready state.")
    st.stop()
else:
    try:
        dataframe = pd.read_csv(uploaded_file)
    except Exception as exc:
        st.error("The CSV could not be read.")
        st.exception(exc)
        st.stop()

    preview1, preview2, preview3, preview4 = st.columns(4)
    preview1.metric("Rows", f"{len(dataframe):,}")
    preview2.metric("Columns", len(dataframe.columns))
    preview3.metric("Missing Values", f"{int(dataframe.isnull().sum().sum()):,}")
    preview4.metric("Memory", f"{dataframe.memory_usage(deep=True).sum() / 1024:.1f} KB")

    with st.expander("Preview (first 10 rows)", expanded=True):
        st.dataframe(dataframe.head(10), use_container_width=True)

    st.markdown("---")

    run_col, hint_col = st.columns([1, 3])
    with run_col:
        run_button = st.button("Run Analysis", type="primary", use_container_width=True)
    with hint_col:
        st.caption("Runs may take several minutes depending on dataset size and model latency.")

    if run_button:
        st.session_state.pop("analysis_result", None)
        with st.status("Running multi-agent analysis...", expanded=True) as status:
            st.write("Submitting the uploaded dataset to the orchestration pipeline.")
            result = run_analysis(
                dataframe,
                source_name=uploaded_file.name,
            )
            st.session_state["analysis_result"] = result
            if result["status"] in {"success", "partial_success"}:
                status.update(label="Analysis complete", state="complete", expanded=False)
            else:
                status.update(label="Analysis failed", state="error", expanded=True)
        st.rerun()

    result = st.session_state.get("analysis_result")
    if not result:
        st.stop()

    if result["status"] in {"success", "partial_success"}:
        render_success_state(result)
    else:
        render_error_state(result)
